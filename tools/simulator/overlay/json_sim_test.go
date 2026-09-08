package cmd

import (
	"bytes"
	"encoding/json"
	"math"
	"os"
	"sort"
	"testing"
	"time"

	simulator "github.com/wowsims/wotlk/sim"
	"github.com/wowsims/wotlk/sim/core"
	"github.com/wowsims/wotlk/sim/core/proto"
	"github.com/wowsims/wotlk/sim/core/stats"
	"google.golang.org/protobuf/encoding/protojson"
)

func init() { simulator.RegisterAll() }
func TestEvaluateJSONRejectsMissingPlayer(t *testing.T) {
	if _, err := evaluateJSON(&proto.RaidSimRequest{}); err == nil {
		t.Fatal("missing raid must fail")
	}
}

func TestEvaluateJSONItemVersionFlag(t *testing.T) {
	command, _, err := rootCmd.Find([]string{"json-sim"})
	if err != nil {
		t.Fatal(err)
	}
	flag := command.Flags().Lookup("item-version")
	if flag == nil {
		t.Fatal("json-sim must expose an item-version selector")
	}
	if flag.DefValue != "classic" {
		t.Fatalf("legacy CLI default changed: %s", flag.DefValue)
	}
}

func TestEvaluateJSONRejectsUnknownItemVersion(t *testing.T) {
	if _, err := evaluateItemVersion(&proto.RaidSimRequest{}, true, "warmane"); err == nil {
		t.Fatal("unknown versions must fail")
	}
}

func itemVersionRequest(t *testing.T) *proto.RaidSimRequest {
	t.Helper()
	data, err := os.ReadFile("json_sim_warrior_request_test.json")
	if err != nil {
		t.Fatal(err)
	}
	request := &proto.RaidSimRequest{}
	if err := protojson.Unmarshal(data, request); err != nil {
		t.Fatal(err)
	}
	request.SimOptions.Iterations = 2
	request.SimOptions.RandomSeed = 100
	return request
}

func TestEvaluateJSONOriginalMjolnirPassiveAndNativeProc(t *testing.T) {
	for _, test := range []struct {
		version       string
		passive, proc float64
	}{{"classic", 115, 751}, {"original", 102, 665}, {"classic", 115, 751}} {
		t.Run(test.version, func(t *testing.T) {
			restore, err := core.UseItemVersion(test.version)
			if err != nil {
				t.Fatal(err)
			}
			defer restore()
			item := core.ItemsByID[45931]
			if item.Stats[stats.MeleeCrit] != test.passive || item.Stats[stats.SpellCrit] != test.passive {
				t.Fatalf("wrong passive crit: %v", item.Stats)
			}
			request := itemVersionRequest(t)
			request.Raid.Parties[0].Players[0].Equipment.Items[13] = &proto.ItemSpec{Id: 45931}
			sim := core.NewSim(request)
			character := sim.Raid.Parties[0].Players[0].GetCharacter()
			aura := character.GetAura("Mjolnir Runestone Proc")
			if aura == nil {
				t.Fatal("native Mjolnir proc was not registered")
			}
			if aura.Duration != 10*time.Second {
				t.Fatalf("proc duration changed: %s", aura.Duration)
			}
			if aura.Icd == nil || aura.Icd.Duration != 45*time.Second {
				t.Fatalf("proc ICD changed: %v", aura.Icd)
			}
			before := character.GetStats()[stats.ArmorPenetration]
			aura.Activate(sim)
			delta := character.GetStats()[stats.ArmorPenetration] - before
			if math.Abs(delta-test.proc) > 0.000001 {
				t.Fatalf("native aura grants %v armor penetration, want %v", delta, test.proc)
			}
			aura.Deactivate(sim)
			if math.Abs(character.GetStats()[stats.ArmorPenetration]-before) > 0.000001 {
				t.Fatal("proc failed to restore stats")
			}
		})
	}
	if core.ItemsByID[45931].Stats[stats.MeleeCrit] != 115 {
		t.Fatal("original profile leaked into global Classic database")
	}
}

func TestEvaluateJSONOriginalUnchangedGearParity(t *testing.T) {
	first, err := evaluateItemVersion(itemVersionRequest(t), false, "classic")
	if err != nil {
		t.Fatal(err)
	}
	original, err := evaluateItemVersion(itemVersionRequest(t), false, "original")
	if err != nil {
		t.Fatal(err)
	}
	last, err := evaluateItemVersion(itemVersionRequest(t), false, "classic")
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(canonicalResult(t, first), canonicalResult(t, original)) || !bytes.Equal(canonicalResult(t, first), canonicalResult(t, last)) {
		t.Fatal("unchanged gear lost deterministic parity or profile leaked")
	}
}

func TestEvaluateJSONOriginalRejectsUnsupportedAndCustomData(t *testing.T) {
	request := itemVersionRequest(t)
	request.Raid.Parties[0].Players[0].Equipment.Items[13] = &proto.ItemSpec{Id: 46312}
	if _, err := evaluateItemVersion(request, true, "original"); err == nil {
		t.Fatal("unsupported original item accepted")
	}
	request = itemVersionRequest(t)
	request.Raid.Parties[0].Players[0].Database = &proto.SimDatabase{}
	if _, err := evaluateItemVersion(request, true, "original"); err == nil {
		t.Fatal("custom mechanics accepted")
	}
	if core.ItemsByID[45931].Stats[stats.MeleeCrit] != 115 {
		t.Fatal("error path failed to restore Classic profile")
	}
}

// The engine emits action metrics from Go maps; compare their values without
// treating that unspecified repeated-field order as a mechanical difference.
func canonicalResult(t *testing.T, raw []byte) []byte {
	t.Helper()
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		t.Fatal(err)
	}
	var canonicalize func(any)
	canonicalize = func(value any) {
		switch v := value.(type) {
		case map[string]any:
			for _, child := range v {
				canonicalize(child)
			}
		case []any:
			for _, child := range v {
				canonicalize(child)
			}
			if len(v) > 0 {
				if first, ok := v[0].(map[string]any); ok && first["id"] != nil {
					sort.Slice(v, func(i, j int) bool {
						a, _ := json.Marshal(v[i])
						b, _ := json.Marshal(v[j])
						return bytes.Compare(a, b) < 0
					})
				}
			}
		}
	}
	canonicalize(value)
	result, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return result
}

func TestEvaluateJSONOriginalProcOnUseAndStackingEffects(t *testing.T) {
	cases := []struct {
		id                int32
		label             string
		stat              stats.Stat
		classic, original float64
		stacking          bool
	}{
		{45518, "Flare of the Heavens Proc", stats.SpellPower, 959, 850, false},
		{45609, "Comet's Trail Proc", stats.MeleeHaste, 819, 726, false},
		{45466, "ItemActive-45466", stats.MeleeHaste, 457, 432, false},
		{45308, "Eye of the Broodmother Proc", stats.SpellPower, 26, 25, true},
		{46051, "Meteorite Crystal Aura", stats.MP5, 85, 75, true},
	}
	for _, version := range []string{"classic", "original", "classic"} {
		for _, test := range cases {
			t.Run(version+"/"+test.label, func(t *testing.T) {
				restore, err := core.UseItemVersion(version)
				if err != nil {
					t.Fatal(err)
				}
				defer restore()
				request := itemVersionRequest(t)
				request.Raid.Parties[0].Players[0].Equipment.Items[13] = &proto.ItemSpec{Id: test.id}
				sim := core.NewSim(request)
				character := sim.Raid.Parties[0].Players[0].GetCharacter()
				aura := character.GetAura(test.label)
				if aura == nil {
					t.Fatalf("missing native aura %s", test.label)
				}
				before := character.GetStats()[test.stat]
				aura.Activate(sim)
				if test.stacking {
					aura.AddStack(sim)
				}
				want := test.classic
				if version == "original" {
					want = test.original
				}
				got := character.GetStats()[test.stat] - before
				if math.Abs(got-want) > 0.000001 {
					t.Fatalf("native effect grants %v, want %v", got, want)
				}
				aura.Deactivate(sim)
			})
		}
	}
}

func TestEvaluateJSONDatabaseScopeRestoresEveryTable(t *testing.T) {
	const itemID int32 = 900001
	const gemID int32 = 900002
	const enchantID int32 = 900003
	restore, err := core.UseItemVersion("classic")
	if err != nil {
		t.Fatal(err)
	}
	core.ItemsByID[itemID] = core.Item{ID: itemID}
	core.GemsByID[gemID] = core.Gem{ID: gemID}
	core.EnchantsByEffectID[enchantID] = core.Enchant{EffectID: enchantID}
	restore()
	if _, ok := core.ItemsByID[itemID]; ok {
		t.Fatal("request item data leaked")
	}
	if _, ok := core.GemsByID[gemID]; ok {
		t.Fatal("request gem data leaked")
	}
	if _, ok := core.EnchantsByEffectID[enchantID]; ok {
		t.Fatal("request enchant data leaked")
	}
}
