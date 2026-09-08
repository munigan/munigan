package core

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/wowsims/wotlk/sim/core/proto"
	"github.com/wowsims/wotlk/sim/core/stats"
	"google.golang.org/protobuf/encoding/protojson"
)

// The build produces this file from the checked-in, source-verified catalog.
// It cannot be supplied by a simulation request.
//
//go:embed original-item-profile.json
var originalItemProfileJSON []byte

type originalItemMechanic struct {
	Original    float64 `json:"original"`
	Stats       []int   `json:"stats"`
	FrostStrike float64 `json:"frostStrike"`
}

var originalItemProfile struct {
	Items       []json.RawMessage              `json:"items"`
	Unsupported []int32                        `json:"unsupportedItemIds"`
	Mechanics   map[int32]originalItemMechanic `json:"mechanics"`
}
var originalItemProfileOnce sync.Once
var originalItemProfileError error
var originalItemOverrides map[int32]Item
var originalUnsupportedItems map[int32]bool
var originalItemEffectsActive bool

// UseItemVersion scopes trusted static and effect overrides to one synchronous
// simulation. The JSON CLI serializes callers while the engine's raid workers
// read this immutable profile. Always call the returned restore function.
func UseItemVersion(version string) (func(), error) {
	if version != "original" && version != "classic" {
		return nil, fmt.Errorf("invalid item version %q: expected original or classic", version)
	}
	originalItemProfileOnce.Do(func() {
		originalItemProfileError = json.Unmarshal(originalItemProfileJSON, &originalItemProfile)
		if originalItemProfileError != nil {
			return
		}
		originalItemOverrides = make(map[int32]Item, len(originalItemProfile.Items))
		originalUnsupportedItems = make(map[int32]bool, len(originalItemProfile.Unsupported))
		for _, id := range originalItemProfile.Unsupported {
			originalUnsupportedItems[id] = true
		}
		for _, raw := range originalItemProfile.Items {
			item := &proto.SimItem{}
			if err := protojson.Unmarshal(raw, item); err != nil {
				originalItemProfileError = err
				return
			}
			originalItemOverrides[item.Id] = ItemFromProto(item)
		}
	})
	if originalItemProfileError != nil {
		return nil, originalItemProfileError
	}
	previousItems := ItemsByID
	previousGems := GemsByID
	previousEnchants := EnchantsByEffectID
	previousEffects := originalItemEffectsActive
	// Isolate any item additions made by the engine's addToDatabase as well.
	ItemsByID = make(map[int32]Item, len(previousItems))
	for id, item := range previousItems {
		ItemsByID[id] = item
	}
	GemsByID = make(map[int32]Gem, len(previousGems))
	for id, gem := range previousGems {
		GemsByID[id] = gem
	}
	EnchantsByEffectID = make(map[int32]Enchant, len(previousEnchants))
	for id, enchant := range previousEnchants {
		EnchantsByEffectID[id] = enchant
	}
	originalItemEffectsActive = version == "original"
	if originalItemEffectsActive {
		for id, item := range originalItemOverrides {
			ItemsByID[id] = item
		}
		for id := range originalUnsupportedItems {
			delete(ItemsByID, id)
		}
	}
	return func() {
		ItemsByID = previousItems
		GemsByID = previousGems
		EnchantsByEffectID = previousEnchants
		originalItemEffectsActive = previousEffects
	}, nil
}

func UnsupportedOriginalItem(id int32) bool {
	return originalItemEffectsActive && originalUnsupportedItems[id]
}

// ItemVersionStats runs at agent construction, never package initialization, so
// registrations cannot capture another profile's values between requests.
func ItemVersionStats(itemID int32, classic stats.Stats) stats.Stats {
	if !originalItemEffectsActive {
		return classic
	}
	if mechanic, ok := originalItemProfile.Mechanics[itemID]; ok {
		for _, index := range mechanic.Stats {
			classic[index] = mechanic.Original
		}
	}
	return classic
}
func ItemVersionScalar(itemID int32, classic float64) float64 {
	if originalItemEffectsActive {
		if mechanic, ok := originalItemProfile.Mechanics[itemID]; ok {
			return mechanic.Original
		}
	}
	return classic
}
func ItemVersionFrostStrikeBonus(classic float64) float64 {
	if originalItemEffectsActive {
		return originalItemProfile.Mechanics[45254].FrostStrike
	}
	return classic
}
