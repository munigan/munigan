package cmd
import (
 "testing"
 "github.com/wowsims/wotlk/sim/core/proto"
)
func TestEvaluateJSONRejectsMissingPlayer(t *testing.T) {
 if _,err:=evaluateJSON(&proto.RaidSimRequest{});err==nil {t.Fatal("missing raid must fail")}
}
