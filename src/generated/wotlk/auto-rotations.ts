// @ts-nocheck
// Generated from the pinned simulator autoRotation functions. Do not edit.
import data from "../../../data/wotlk/presets.json";
import {HandType,ItemSlot} from "./common";
import {ShamanImbue} from "./shaman";
export const autoRotations={
"balance_druid":(_player: Player<Spec.SpecBalanceDruid>): APLRotation => {
		return data.balance_druid.presets.ROTATION_PRESET_P3_APL.rotation.rotation!;
	},
"feral_druid":(_player: Player<Spec.SpecFeralDruid>): APLRotation => {
		return data.feral_druid.presets.APL_ROTATION_DEFAULT.rotation.rotation!;
	},
"elemental_shaman":(_player: Player<Spec.SpecElementalShaman>): APLRotation => {
		return data.elemental_shaman.presets.ROTATION_PRESET_DEFAULT.rotation.rotation!;
	},
"enhancement_shaman":(player: Player<Spec.SpecEnhancementShaman>): APLRotation => {
		const hasT94P = player.getCurrentStats().sets.includes('Triumphant Nobundo\'s Battlegear (4pc)')
			|| player.getCurrentStats().sets.includes('Nobundo\'s Battlegear (4pc)')
			|| player.getCurrentStats().sets.includes('Triumphant Thrall\'s Battlegear (4pc)')
			|| player.getCurrentStats().sets.includes('Thrall\'s Battlegear (4pc)');
		const options = player.getSpecOptions();

		if (hasT94P) {
			console.log("has set");
			return data.enhancement_shaman.presets.ROTATION_PHASE_3.rotation.rotation!;
		} else if (options.imbueMh == ShamanImbue.FlametongueWeapon) {
			return data.enhancement_shaman.presets.ROTATION_FT_DEFAULT.rotation.rotation!;
		} else {
			return data.enhancement_shaman.presets.ROTATION_WF_DEFAULT.rotation.rotation!;
		}
	},
"hunter":(player: Player<Spec.SpecHunter>): APLRotation => {
		const talentTree = player.getTalentTree();
		const numTargets = player.sim.encounter.targets.length;
		if (numTargets >= 4) {
			return data.hunter.presets.ROTATION_PRESET_AOE.rotation.rotation!;
		} else if (talentTree == 0) {
			return data.hunter.presets.ROTATION_PRESET_BM.rotation.rotation!;
		} else if (talentTree == 1) {
			return data.hunter.presets.ROTATION_PRESET_MM.rotation.rotation!;
		} else {
			return data.hunter.presets.ROTATION_PRESET_SV.rotation.rotation!;
		}
	},
"mage":(player: Player<Spec.SpecMage>): APLRotation => {
		const talentTree = player.getTalentTree();
		const numTargets = player.sim.encounter.targets.length;
		if (numTargets > 3) {
			if (talentTree == 0) {
				return data.mage.presets.ARCANE_ROTATION_PRESET_AOE.rotation.rotation!;
			} else if (talentTree == 1) {
				return data.mage.presets.FIRE_ROTATION_PRESET_AOE.rotation.rotation!;
			} else {
				return data.mage.presets.FROST_ROTATION_PRESET_AOE.rotation.rotation!;
			}
		} else if (talentTree == 0) {
			return data.mage.presets.ARCANE_ROTATION_PRESET_DEFAULT.rotation.rotation!;
		} else if (talentTree == 1) {
			if (player.getTalents().iceShards > 0) {
				return data.mage.presets.FROSTFIRE_ROTATION_PRESET_DEFAULT.rotation.rotation!;
			}
			return data.mage.presets.FIRE_ROTATION_PRESET_DEFAULT.rotation.rotation!;
		} else {
			return data.mage.presets.FROST_ROTATION_PRESET_DEFAULT.rotation.rotation!;
		}
	},
"rogue":(player: Player<Spec.SpecRogue>): APLRotation => {
		const talentTree = player.getTalentTree();
		const numTargets = player.sim.encounter.targets.length;
		if (numTargets >= 5) {
			return data.rogue.presets.ROTATION_PRESET_AOE.rotation.rotation!;
		} else if (talentTree == 0) {
			return data.rogue.presets.ROTATION_PRESET_MUTILATE_EXPOSE.rotation.rotation!;
		} else if (talentTree == 1) {
			return data.rogue.presets.ROTATION_PRESET_COMBAT_EXPOSE.rotation.rotation!;
		} else {
			// TODO: Need a sub rotation here
			return data.rogue.presets.ROTATION_PRESET_MUTILATE_EXPOSE.rotation.rotation!;
		}
	},
"retribution_paladin":(_player: Player<Spec.SpecRetributionPaladin>): APLRotation => {
		return data.retribution_paladin.presets.ROTATION_PRESET_DEFAULT.rotation.rotation!;
	},
"shadow_priest":(player: Player<Spec.SpecShadowPriest>): APLRotation => {
		const numTargets = player.sim.encounter.targets.length;
		if (numTargets > 4) {
			return data.shadow_priest.presets.ROTATION_PRESET_AOE4PLUS.rotation.rotation!;
		} else if (numTargets > 1) {
			return data.shadow_priest.presets.ROTATION_PRESET_AOE24.rotation.rotation!;
		} else {
			return data.shadow_priest.presets.ROTATION_PRESET_DEFAULT.rotation.rotation!;
		}
	},
"smite_priest":(_player: Player<Spec.SpecSmitePriest>): APLRotation => {
		return data.smite_priest.presets.ROTATION_PRESET_APL.rotation.rotation!;
	},
"warlock":(player: Player<Spec.SpecWarlock>): APLRotation => {
		const talentTree = player.getTalentTree();
		if (talentTree == 0) {
			return data.warlock.presets.APL_Affliction_Default.rotation.rotation!;
		} else if (talentTree == 1) {
			return data.warlock.presets.APL_Demo_Default.rotation.rotation!;
		} else {
			return data.warlock.presets.APL_Destro_Default.rotation.rotation!;
		}
	},
"warrior":(player: Player<Spec.SpecWarrior>): APLRotation => {
		const talentTree = player.getTalentTree();
		if (talentTree == 0) {
			return data.warrior.presets.ROTATION_ARMS_SUNDER.rotation.rotation!;
		} else {
			return data.warrior.presets.ROTATION_FURY_SUNDER.rotation.rotation!;
		}
	},
"deathknight":(player: Player<Spec.SpecDeathknight>): APLRotation => {
		const talentTree = player.getTalentTree();
		const numTargets = player.sim.encounter.targets.length;
		switch (talentTree) {
			case 0:
				if (player.getSpecOptions().drwPestiApply || numTargets > 1) {
					if (numTargets > 5) {
						return data.deathknight.presets.BLOOD_PESTI_AOE_ROTATION_PRESET_DEFAULT.rotation.rotation!;
					} else {
						return data.deathknight.presets.BLOOD_DPS_ROTATION_PRESET_DEFAULT.rotation.rotation!;
					}
				} else {
					return data.deathknight.presets.BLOOD_DPS_ROTATION_PRESET_DEFAULT.rotation.rotation!;
				}
			case 1:
				const talentPoints = player.getTalentTreePoints()
				// TODO: Add Frost AOE rotation
				if (talentPoints[0] > talentPoints[2]) {
					return data.deathknight.presets.FROST_BL_PESTI_ROTATION_PRESET_DEFAULT.rotation.rotation!;
				} else {
					return data.deathknight.presets.FROST_UH_PESTI_ROTATION_PRESET_DEFAULT.rotation.rotation!;
				}
			default:
				if (numTargets > 1) {
					return data.deathknight.presets.UNHOLY_DND_AOE_ROTATION_PRESET_DEFAULT.rotation.rotation!;
				} else {
					if (player.getEquippedItem(ItemSlot.ItemSlotMainHand)!.item.handType == HandType.HandTypeTwoHand) {
						return data.deathknight.presets.UNHOLY_2H_ROTATION_PRESET_DEFAULT.rotation.rotation!;
					} else {
						return data.deathknight.presets.UNHOLY_DW_ROTATION_PRESET_DEFAULT.rotation.rotation!;
					}
				}
		}
	},
};
