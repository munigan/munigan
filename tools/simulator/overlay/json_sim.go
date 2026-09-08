package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"

	"github.com/spf13/cobra"
	"github.com/wowsims/wotlk/sim/core"
	"github.com/wowsims/wotlk/sim/core/proto"
	"google.golang.org/protobuf/encoding/protojson"
	gproto "google.golang.org/protobuf/proto"
)

func evaluateJSON(request *proto.RaidSimRequest) (output []byte, err error) {
	return evaluateMode(request, false)
}

var itemVersionMutex sync.Mutex

func evaluateMode(request *proto.RaidSimRequest, statsOnly bool) (output []byte, err error) {
	return evaluateItemVersion(request, statsOnly, "classic")
}
func evaluateItemVersion(request *proto.RaidSimRequest, statsOnly bool, itemVersion string) (output []byte, err error) {
	itemVersionMutex.Lock()
	defer itemVersionMutex.Unlock()
	restore, err := core.UseItemVersion(itemVersion)
	if err != nil {
		return nil, err
	}
	defer restore()
	defer func() {
		if r := recover(); r != nil {
			output = nil
			err = fmt.Errorf("engine: %v", r)
		}
	}()
	if request == nil || request.Raid == nil || len(request.Raid.Parties) != 1 || request.Raid.Parties[0] == nil || len(request.Raid.Parties[0].Players) != 1 || request.SimOptions == nil || request.SimOptions.Iterations < 1 || request.Encounter == nil || len(request.Encounter.Targets) == 0 {
		return nil, fmt.Errorf("one player, encounter and positive iterations required")
	}
	player := request.Raid.Parties[0].Players[0]
	if player == nil {
		return nil, fmt.Errorf("player required")
	}
	if itemVersion == "original" {
		if player.Database != nil {
			return nil, fmt.Errorf("original items require the trusted built-in database")
		}
		for _, item := range player.GetEquipment().GetItems() {
			if item != nil && core.UnsupportedOriginalItem(item.Id) {
				return nil, fmt.Errorf("item %d is unsupported in Original WotLK", item.Id)
			}
		}
	}
	stats := core.ComputeStats(&proto.ComputeStatsRequest{Raid: gproto.Clone(request.Raid).(*proto.Raid), Encounter: gproto.Clone(request.Encounter).(*proto.Encounter)})
	if stats.ErrorResult != "" {
		return nil, fmt.Errorf("stats: %s", stats.ErrorResult)
	}
	result := &proto.RaidSimResult{}
	if !statsOnly {
		result = core.RunRaidSim(gproto.Clone(request).(*proto.RaidSimRequest))
	}
	if result.ErrorResult != "" {
		return nil, fmt.Errorf("simulation: %s", result.ErrorResult)
	}
	simJSON, err := protojson.MarshalOptions{EmitUnpopulated: true}.Marshal(result)
	if err != nil {
		return nil, err
	}
	statsJSON, err := protojson.MarshalOptions{EmitUnpopulated: true}.Marshal(stats)
	if err != nil {
		return nil, err
	}
	return json.Marshal(struct {
		Raid  json.RawMessage `json:"raidResult"`
		Stats json.RawMessage `json:"statsResult"`
	}{simJSON, statsJSON})
}
func init() {
	var input, output, itemVersion string
	var statsOnly bool
	command := &cobra.Command{Use: "json-sim", Short: "Structured single-player simulation", RunE: func(cmd *cobra.Command, args []string) error {
		data, err := os.ReadFile(input)
		if err != nil {
			return err
		}
		request := &proto.RaidSimRequest{}
		if err = protojson.Unmarshal(data, request); err != nil {
			return err
		}
		result, err := evaluateItemVersion(request, statsOnly, itemVersion)
		if err != nil {
			return err
		}
		return os.WriteFile(output, result, 0600)
	}}
	command.Flags().StringVar(&itemVersion, "item-version", "classic", "Item data: original or classic")
	command.Flags().BoolVar(&statsOnly, "stats-only", false, "Compute stats without running iterations")
	command.Flags().StringVar(&input, "infile", "", "Input JSON")
	command.Flags().StringVar(&output, "outfile", "", "Output JSON")
	_ = command.MarkFlagRequired("infile")
	_ = command.MarkFlagRequired("outfile")
	rootCmd.AddCommand(command)
}
