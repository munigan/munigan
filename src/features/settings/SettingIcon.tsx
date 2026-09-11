"use client";
import { useState } from "react";
import Image from "next/image";
import { Profession } from "@/generated/wotlk/common";
export function SettingIcon({ icon }: { icon?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="setting-icon" aria-hidden="true">
      {icon && !failed ? (
        <Image
          unoptimized
          src={`https://wow.zamimg.com/images/wow/icons/large/${icon}.jpg`}
          width={32}
          height={32}
          alt=""
          onError={() => setFailed(true)}
        />
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z" />
        </svg>
      )}
    </span>
  );
}
export const professionIcons: Record<number, string> = {
  [Profession.Alchemy]: "trade_alchemy",
  [Profession.Blacksmithing]: "trade_blacksmithing",
  [Profession.Enchanting]: "trade_engraving",
  [Profession.Engineering]: "trade_engineering",
  [Profession.Herbalism]: "trade_herbalism",
  [Profession.Inscription]: "inv_inscription_tradeskill01",
  [Profession.Jewelcrafting]: "inv_misc_gem_01",
  [Profession.Leatherworking]: "trade_leatherworking",
  [Profession.Mining]: "trade_mining",
  [Profession.Skinning]: "inv_misc_pelt_wolf_01",
  [Profession.Tailoring]: "trade_tailoring",
};
