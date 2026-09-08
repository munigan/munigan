package cmd

import (
 "encoding/json"
 "fmt"
 "os"
 "github.com/spf13/cobra"
 "github.com/wowsims/wotlk/sim/core"
 "github.com/wowsims/wotlk/sim/core/proto"
 "google.golang.org/protobuf/encoding/protojson"
 gproto "google.golang.org/protobuf/proto"
)
func evaluateJSON(request *proto.RaidSimRequest) (output []byte, err error) { return evaluateMode(request,false) }
func evaluateMode(request *proto.RaidSimRequest,statsOnly bool) (output []byte, err error) {
 defer func(){if r:=recover();r!=nil{output=nil;err=fmt.Errorf("engine: %v",r)}}()
 if request.Raid==nil || len(request.Raid.Parties)!=1 || len(request.Raid.Parties[0].Players)!=1 || request.SimOptions==nil || request.SimOptions.Iterations<1 || request.Encounter==nil || len(request.Encounter.Targets)==0{return nil,fmt.Errorf("one player, encounter and positive iterations required")}
 stats:=core.ComputeStats(&proto.ComputeStatsRequest{Raid:gproto.Clone(request.Raid).(*proto.Raid),Encounter:gproto.Clone(request.Encounter).(*proto.Encounter)})
 result:=&proto.RaidSimResult{}
 if !statsOnly {result=core.RunRaidSim(gproto.Clone(request).(*proto.RaidSimRequest))}
 if result.ErrorResult!="" {return nil,fmt.Errorf("simulation: %s",result.ErrorResult)}
 simJSON,err:=protojson.MarshalOptions{EmitUnpopulated:true}.Marshal(result);if err!=nil{return nil,err}
 statsJSON,err:=protojson.MarshalOptions{EmitUnpopulated:true}.Marshal(stats);if err!=nil{return nil,err}
 return json.Marshal(struct{Raid json.RawMessage `json:"raidResult"`; Stats json.RawMessage `json:"statsResult"`}{simJSON,statsJSON})
}
func init(){
 var input,output string
 var statsOnly bool
 command:=&cobra.Command{Use:"json-sim",Short:"Structured single-player simulation",RunE:func(cmd *cobra.Command,args []string)error{
  data,err:=os.ReadFile(input);if err!=nil{return err};request:=&proto.RaidSimRequest{}
  if err=protojson.Unmarshal(data,request);err!=nil{return err}
  result,err:=evaluateMode(request,statsOnly);if err!=nil{return err}
  return os.WriteFile(output,result,0600)
 }}
 command.Flags().BoolVar(&statsOnly,"stats-only",false,"Compute stats without running iterations")
 command.Flags().StringVar(&input,"infile","","Input JSON")
 command.Flags().StringVar(&output,"outfile","","Output JSON")
 _=command.MarkFlagRequired("infile");_=command.MarkFlagRequired("outfile")
 rootCmd.AddCommand(command)
}
