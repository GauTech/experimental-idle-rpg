"use strict";

import { skills } from "./skills.js";
const magics = {};

class Magic {
    constructor({ magic_id, 
                  names, 
                  description, 
                  mana_cost = 1, 
				  health_cost = 0,
				  related_skill = null,
				  self_effect = [],
				  target_effect = [],
				  special_effect = [],
				  duration = 0,
				  cooldown = 60,
				  is_unlocked = false
				  
                }) 
				{
		this.magic_id = magic_id;
        this.names = names; // put only {0: name} to have skill always named the same, no matter the level
        this.description = description;
        this.mana_cost = mana_cost; //mana cost to cast spell
		this.health_cost = health_cost; //health cost to cast, can use for e.g. blood magic
        this.related_skill = related_skill; //max possible lvl, dont make it too high
        this.self_effect = self_effect; //self_targetted buff effects
        this.target_effect = target_effect; //damage and debuff effects that hit enemies [damage,target_count, damage_type]
		this.special_effect = special_effect; // 
        this.duration = duration;
		this.cooldown = cooldown;		
		this.is_unlocked = is_unlocked;
				}
}

magics["Fireball"] = new Magic({
    names:  {0: "Fireball"},
    description: "Fireball",
	related_skill: "Pyromancy",
    mana_cost:2,
	target_effect: [10,2,"Fire"],
	cooldown:120
});

magics["Ice Beam"] = new Magic({
    names:  {0: "Ice Beam"},
    is_unlocked: false,
    description: "Ice Beam",
	related_skill: "Cryomancy",
    mana_cost:2,
	target_effect: [10,2,"Ice"],
	cooldown:120
});

magics["Magic Missile"] = new Magic({
    names:  {0: "Magic Missile"},
    description: "Magic Missile",
	related_skill: "Magic Potency",
    mana_cost:2,
	target_effect: [10,2,"Magical"],
	cooldown:120
});

magics["Haste"] = new Magic({
    names: {0: "Haste"},
    description: "Temporary attack speed boost",
    mana_cost:2,
			self_effect: [
        {
            stat: "attack_speed",
            multiplier: 1.2,
        },
    ],
	related_skill: "Chronomancy",
	duration:60,
	cooldown:120
});

magics["Strengthen"] = new Magic({
    names: { 0: "Strengthen" },
    description: "Temporary strength boost",
    mana_cost: 3,
        self_effect: [
        {
            stat: "strength",
            flat: 10,
			multiplier: 1.5
        },
    ],
	related_skill: "Enhancement",
    duration: 60,
    cooldown: 120
});

magics["Empower"] = new Magic({
    names: {0: "Empower"},
    description: "Temporary magic boost",
    mana_cost:1,
	self_effect: [
        {
            stat: "magic",
            flat: 10,
			multiplier: 1.5
        },
    ],
	related_skill: "Enhancement",
	duration:60,
	cooldown:120
});

magics["Shield"] = new Magic({
    names: {0: "Shield"},
    description: "Temporary defense boost",
    mana_cost:2,
		self_effect: [
        {
            stat: "defense",
            flat: 5,
        },
    ],
	related_skill: "Barrier Magic",
	duration:60,
	cooldown:120
});

magics["Mirror Image"] = new Magic({
    names: {0: "Mirror Image"},
    description: "Temporary evasion boost",
    mana_cost:2,
		self_effect: [
        {
            stat: "evasion_points",
            multiplier: 1.2,
        },
    ],
	related_skill: "Illusion Magic",
	duration:60,
	cooldown:120
});

magics["Regen"] = new Magic({
    names: {0: "Regen"},
    description: "Regenerative Effect",
    mana_cost:2,
		self_effect: [
        {
            stat: "health_regeneration_flat",
            flat: 10,
        },
    ],
	related_skill: "Recovery Magic",
	duration:120,
	cooldown:600
});

magics["Teleport"] = new Magic({
    names: {0: "Teleport"},
    description: "Bend Space",
    mana_cost:10,
	special_effect:["Warp"],
	related_skill: "Spatial Magic",
	cooldown:600
});

magics["Raise Dead"] = new Magic({
    names: {0: "Raise Dead"},
    description: "Raise Dead",
    mana_cost:10,
	special_effect:["Raise Dead"],
	related_skill: "Necromancy",
	cooldown:600
});


export {magics};