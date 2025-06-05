"use strict";

import { InventoryHaver } from "./inventory.js";
import { skills, weapon_type_to_skill } from "./skills.js";
import { update_displayed_character_inventory, update_displayed_equipment, 
         update_displayed_stats,
         update_displayed_health, update_displayed_stamina, update_displayed_mana,
         update_displayed_skill_xp_gain, update_all_displayed_skills_xp_gain,
         update_displayed_xp_bonuses } from "./display.js";
import { active_effects, current_location, current_stance, favourite_consumables, remove_consumable_from_favourites, unlock_combat_stance, unlock_magic} from "./main.js";
import { current_game_time, is_night } from "./game_time.js";
import { stances } from "./combat_stances.js";
import { item_templates } from "./items.js";


const base_block_chance = 0.75; //+20 from the skill

const base_xp_cost = 10;

class Hero extends InventoryHaver {
        constructor() {
                super();
                this.base_stats = {
						max_health: 100, 
						health: 100,
						health_regeneration_flat: 0, //in combat
						health_regeneration_percent: 0, //in combat
						health_loss_flat: 0, //despite the name, it's values below 0 that mean actual health loss
						health_loss_percent: 0,
						max_stamina: 100,
						stamina: 100,
						stamina_regeneration_flat: 0, //in combat
						stamina_regeneration_percent: 0, //in combat
						stamina_loss_flat: 0, //in combat
						stamina_loss_percent: 0, //in combat
						stamina_efficiency: 1,
						max_mana: 10,
						mana: 10,
						mana_regeneration_flat: 0, //in combat
						mana_regeneration_percent: 0, //in combat
						mana_efficiency: 1,
						strength: 10, 
						agility: 10, 
						dexterity: 10, 
						intuition: 10,
						magic: 0, 
						attack_speed: 1, 
						crit_rate: 0.05, 
						crit_multiplier: 1.3,
						attack_power: 0,
						magic_power: 0,		
						defense: 0,
						block_strength: 0,
						block_chance: 0,
						evasion_points: 0, //EP
						attack_points: 0, //AP
                };
                this.name = "Hero";
                this.titles = {};
                this.stats = {
                        full: {...this.base_stats}, 
                        total_flat: {},
                        total_multiplier: {},
                        flat: {
                                level: {},
                                skills: {},
                                equipment: {},
                                skill_milestones: {},
                                books: {},
                                light_level: {},
                                environment: {},
								elixirs: {},
                        },
                        multiplier: {
                                skills: {},
                                skill_milestones: {},
                                equipment: {},
                                books: {},
                                stance: {},
                                light_level: {},
                                environment: {},
                        },
						percent: {},
                };
                this.reputation = { //effects go up to 1000?
                        village: 0,
                        slums: 0,
                        town: 0,
                };
                this.bonus_skill_levels = {
                        full: {
                                //all skills added in main.js in setup()
                        },
                        flat: {
                                equipment: {},
                                active_effects: {},
                                skills: {}, //for some rare cases, generally bonuses should be limited to "temporary" sources
                        }
                };
                this.xp_bonuses = {
                        total_multiplier: {
                                hero: 1,
                                all: 1,
                                all_skill: 1,
                                //then all skills and categories added in main.js in setup()
                        },
                        multiplier: {
                                levels: {},
                                skills: {},
                                //equipment: {},
                                books: {}
                        }
                };
                this.equipment = {
                        head: null, torso: null, 
                        arms: null, ring: null, 
                        weapon: null, "off-hand": null,
                        legs: null, feet: null, 
                        amulet: null, artifact: null,
                
                        axe: null, 
                        pickaxe: null,
                        sickle: null,
						rod: null,
                };
                this.money = 0;
                       this.xp = {
				current_level: 0,
				total_xp: 0,
				current_xp: 0,
				xp_to_next_lvl: base_xp_cost, 
				total_xp_to_next_lvl: base_xp_cost,
				base_xp_cost: base_xp_cost,
				
				get xp_scaling() {
					const bonus = skills["Limit Breaking"].get_level_bonus?.() ?? 0;
					const raw_scaling = 1.6 - bonus;
					return Math.max(1.01, raw_scaling); // Avoid division by zero
				}
			};
        }
		
        add_xp({xp_to_add, use_bonus = true}) {
                if(use_bonus) {
                        xp_to_add *= (character.xp_bonuses.total_multiplier.hero || 1) * (character.xp_bonuses.total_multiplier.all || 1);
                }
                character.xp.total_xp += xp_to_add;
        
                if(xp_to_add + character.xp.current_xp < character.xp.xp_to_next_lvl) { // no levelup
                        character.xp.current_xp += xp_to_add;
                }
                else { //levelup
                        let level_after_xp = 0;
                        
                        while(character.xp.total_xp >= character.xp.total_xp_to_next_lvl) {
                                level_after_xp += 1;
                                
                                character.xp.total_xp_to_next_lvl = Math.round(character.xp.base_xp_cost * (1 - character.xp.xp_scaling ** (level_after_xp + 1))/(1 - character.xp.xp_scaling));
                        } //calculates lvl reached after adding xp
        
                        let total_xp_to_previous_lvl = Math.round(character.xp.base_xp_cost * (1 - character.xp.xp_scaling ** level_after_xp)/(1 - character.xp.xp_scaling));
                        //xp needed for current lvl, same formula but for n-1
        
                        const gains = character.get_level_bonus(level_after_xp);
        
                        character.xp.xp_to_next_lvl = character.xp.total_xp_to_next_lvl - total_xp_to_previous_lvl;
                        character.xp.current_level = level_after_xp;
                        character.xp.current_xp = character.xp.total_xp - total_xp_to_previous_lvl;		
                        
                        return `${character.name} is getting stronger. Reached level ${character.xp.current_level} ${gains}`;
                }
        }

        /**
         * gets bonuses to stats based on current level and level passed as param
         * @param {Number} level 
         * @returns stats bonuses from leveling
         */
			get_level_bonus = function (level) {

			let gained_hp = 0;
			let gained_stamina = 0;
			let gained_str = 0;
			let gained_agi = 0;
			let gained_dex = 0;
			let gained_int = 0;
			let gained_mgc = 0;
			let gained_mana = 0;

			const gained_skill_xp_multiplier = 1.03;
			let total_skill_xp_multiplier = 1;

			for(let i = character.xp.current_level + 1; i <= level; i++) {
					if(i % 2 == 1) {
							gained_str += Math.ceil(i/10);
							gained_int += Math.ceil(i/10);
					} else {
							gained_agi += Math.ceil(i/10);
							gained_dex += Math.ceil(i/10);
					}
					  if(i % 5 == 0) {
							gained_mgc += Math.ceil(i/10);
					}
					if(i % 10 == 0) {
							gained_mana += Math.ceil(i/10);
					} 

					gained_hp += 10 * Math.ceil(i/10);
					gained_stamina += 5; //5 * Math.ceil(i/10) ?;
					total_skill_xp_multiplier = total_skill_xp_multiplier * gained_skill_xp_multiplier;
			}

			character.stats.flat.level.max_health = (character.stats.flat.level.max_health || 0) + gained_hp;
			character.stats.flat.level.health = character.stats.flat.level.max_health;
			character.stats.flat.level.max_stamina = (character.stats.flat.level.max_stamina || 0) + gained_stamina;
			character.stats.flat.level.stamina = character.stats.flat.level.max_stamina;
			character.stats.flat.level.strength = (character.stats.flat.level.strength || 0) + gained_str;
			character.stats.flat.level.intuition = (character.stats.flat.level.intuition || 0) + gained_int;
			character.stats.flat.level.agility = (character.stats.flat.level.agility || 0) + gained_agi;
			character.stats.flat.level.dexterity = (character.stats.flat.level.dexterity || 0) + gained_dex;
			character.stats.flat.level.magic = (character.stats.flat.level.magic || 0) + gained_mgc;
			character.stats.flat.level.max_mana = (character.stats.flat.level.max_mana || 0) + gained_mana;

			character.xp_bonuses.multiplier.levels.all_skill = (character.xp_bonuses.multiplier.levels.all_skill || 1) * total_skill_xp_multiplier;

			let gains = `<br>HP increased by ${gained_hp}<br>Stamina increased by ${gained_stamina}`;
			if(gained_str > 0) {
					gains += `<br>Strength increased by ${gained_str}`;
			}
			if(gained_agi > 0) {
					gains += `<br>Agility increased by ${gained_agi}`;
			}
			if(gained_dex > 0) {
					gains += `<br>Dexterity increased by ${gained_dex}`;
			}
			if(gained_int > 0) {
					gains += `<br>Intuition increased by ${gained_int}`;
			}
			 if(gained_mgc > 0) {
					gains += `<br>Magic increased by ${gained_mgc}`;
			}
				 if(gained_mana > 0) {
					gains += `<br>Mana increased by ${gained_mana}`;
			}

			gains += `<br>Skill xp gains increased by ${Math.round((gained_skill_xp_multiplier-1)*100)}%`;
			
			return gains;
	}
}

const character = new Hero();

character.recalculate_xp_thresholds = function () {
    const scaling = this.xp.xp_scaling; // Use getter
    const lvl = this.xp.current_level;

    this.xp.total_xp_to_next_lvl = Math.round(
        this.xp.base_xp_cost * (1 - scaling ** (lvl + 1)) / (1 - scaling)
    );

    const total_xp_to_current_lvl = Math.round(
        this.xp.base_xp_cost * (1 - scaling ** lvl) / (1 - scaling)
    );

    this.xp.xp_to_next_lvl = this.xp.total_xp_to_next_lvl - total_xp_to_current_lvl;
    this.xp.current_xp = this.xp.total_xp - total_xp_to_current_lvl;
};

/**
 * gets bonuses to stats based on current level and level passed as param
 * @param {Number} level 
 * @returns stats bonuses from leveling
 */
character.get_level_bonus = function (level) {

        let gained_hp = 0;
        let gained_stamina = 0;
        let gained_str = 0;
        let gained_agi = 0;
        let gained_dex = 0;
        let gained_int = 0;
		let gained_mgc = 0;
		let gained_mana = 0;

        const gained_skill_xp_multiplier = 1.03;
        let total_skill_xp_multiplier = 1;

        for(let i = character.xp.current_level + 1; i <= level; i++) {
                if(i % 2 == 1) {
                        gained_str += Math.ceil(i/10);
                        gained_int += Math.ceil(i/10);
                } else {
                        gained_agi += Math.ceil(i/10);
                        gained_dex += Math.ceil(i/10);
                }
				  if(i % 5 == 0) {
                        gained_mgc += Math.ceil(i/10);
                }
				if(i % 10 == 0) {
                        gained_mana += Math.ceil(i/10);
                } 

                gained_hp += 10 * Math.ceil(i/10);
                gained_stamina += 5; //5 * Math.ceil(i/10) ?;
                total_skill_xp_multiplier = total_skill_xp_multiplier * gained_skill_xp_multiplier;
        }

        character.stats.flat.level.max_health = (character.stats.flat.level.max_health || 0) + gained_hp;
        character.stats.flat.level.health = character.stats.flat.level.max_health;
        character.stats.flat.level.max_stamina = (character.stats.flat.level.max_stamina || 0) + gained_stamina;
        character.stats.flat.level.stamina = character.stats.flat.level.max_stamina;
        character.stats.flat.level.strength = (character.stats.flat.level.strength || 0) + gained_str;
        character.stats.flat.level.intuition = (character.stats.flat.level.intuition || 0) + gained_int;
        character.stats.flat.level.agility = (character.stats.flat.level.agility || 0) + gained_agi;
        character.stats.flat.level.dexterity = (character.stats.flat.level.dexterity || 0) + gained_dex;
		character.stats.flat.level.magic = (character.stats.flat.level.magic || 0) + gained_mgc;
		character.stats.flat.level.max_mana = (character.stats.flat.level.max_mana || 0) + gained_mana;

        character.xp_bonuses.multiplier.levels.all_skill = (character.xp_bonuses.multiplier.levels.all_skill || 1) * total_skill_xp_multiplier;

        let gains = `<br>HP increased by ${gained_hp}<br>Stamina increased by ${gained_stamina}`;
        if(gained_str > 0) {
                gains += `<br>Strength increased by ${gained_str}`;
        }
        if(gained_agi > 0) {
                gains += `<br>Agility increased by ${gained_agi}`;
        }
        if(gained_dex > 0) {
                gains += `<br>Dexterity increased by ${gained_dex}`;
        }
        if(gained_int > 0) {
                gains += `<br>Intuition increased by ${gained_int}`;
        }
		 if(gained_mgc > 0) {
                gains += `<br>Magic increased by ${gained_mgc}`;
        }
			 if(gained_mana > 0) {
                gains += `<br>Mana increased by ${gained_mana}`;
        }

        gains += `<br>Skill xp gains increased by ${Math.round((gained_skill_xp_multiplier-1)*100)}%`;
        
        return gains;
}

/**
 * adds skill milestone bonuses to character stats
 * called when a new milestone is reached
 * @param {{flats, multipliers}} bonuses 
 */
character.stats.add_skill_milestone_bonus = function ({stats = {}, xp_multipliers = {}}) {
        Object.keys(stats).forEach(stat => {
                if(stats[stat].flat) {
                        character.stats.flat.skill_milestones[stat] = (character.stats.flat.skill_milestones[stat] || 0) + stats[stat].flat;
                }
                if(stats[stat].multiplier) {
                        character.stats.multiplier.skill_milestones[stat] = (character.stats.multiplier.skill_milestones[stat] || 1) * stats[stat].multiplier;
                }
        });

        if(xp_multipliers?.hero) {
                character.xp_bonuses.multiplier.skills.hero = (character.xp_bonuses.multiplier.skills.hero || 1) * xp_multipliers.hero;
        }
        if(xp_multipliers?.all) {
                character.xp_bonuses.multiplier.skills.all = (character.xp_bonuses.multiplier.skills.all || 1) * xp_multipliers.all;
        }
        if(xp_multipliers?.all_skill) {
                character.xp_bonuses.multiplier.skills.all_skill = (character.xp_bonuses.multiplier.skills.all_skill || 1) * xp_multipliers.all_skill;
        }

        Object.keys(skills).forEach(skill => {
                if(xp_multipliers[skill]) {
                        character.xp_bonuses.multiplier.skills[skill] = (character.xp_bonuses.multiplier.skills[skill] || 1) * xp_multipliers[skill];
                }
        });
}

character.stats.add_elixir_bonus = function ({stats = {}}) {
    Object.keys(stats).forEach(stat => {
        if (stats[stat].flat) {
            const current = character.stats.flat.elixirs[stat] || 0;

            // Use log base 3 with change-of-base formula
            const logBase3 = (x) => Math.log(x) / Math.log(3);

            const threshold = 9;
            const effectiveCurrent = Math.max(0, current - threshold);
            const scalingFactor = current < threshold ? 1 : 1 / (1 + logBase3(effectiveCurrent + 1));

            const scaledValue = stats[stat].flat * scalingFactor;
            character.stats.flat.elixirs[stat] = current + scaledValue;
        }
    });
};

/**
 * adds skill milestone bonuses to character stats
 * called when a new milestone is reached
 * @param {{flats, multipliers}} bonuses 
 */
character.stats.add_book_bonus = function ({multipliers = {}, xp_multipliers = {}, ...unlocks}, apply_unlocks = true) {
    Object.keys(character.base_stats).forEach(stat => {
        if (multipliers[stat]) {
            character.stats.multiplier.books[stat] = (character.stats.multiplier.books[stat] || 1) * multipliers[stat];
        }
    });

    if (xp_multipliers?.hero) {
        character.xp_bonuses.multiplier.skills.hero = (character.xp_bonuses.multiplier.skills.hero || 1) * xp_multipliers.hero;
    }
    if (xp_multipliers?.all) {
        character.xp_bonuses.multiplier.skills.all = (character.xp_bonuses.multiplier.skills.all || 1) * xp_multipliers.all;
    }
    if (xp_multipliers?.all_skill) {
        character.xp_bonuses.multiplier.skills.all_skill = (character.xp_bonuses.multiplier.skills.all_skill || 1) * xp_multipliers.all_skill;
    }

    Object.keys(skills).forEach(skill => {
        if (xp_multipliers[skill]) {
            character.xp_bonuses.multiplier.skills[skill] = (character.xp_bonuses.multiplier.skills[skill] || 1) * xp_multipliers[skill];
        }
    });

    // Only apply unlocks if allowed
    if (apply_unlocks) {
        for (const key in unlocks) {
            if (key.startsWith("unlock_")) {
                const type = key.slice(7); // e.g. "magic", "recipe"
                const value = unlocks[key];
                if (type == "stance") {
                    unlock_combat_stance(value);
                } else if (type == "magic") {
                    unlock_magic(value);
                }
                // etc.
            }
        }
    }
};



character.stats.add_active_effect_bonus = function () {
    character.stats.immunities = {};
    character.stats.flat.active_effect = {};
    character.stats.percent = character.stats.percent || {};
    character.stats.percent.active_effect = {};
    character.stats.multiplier.active_effect = {};

    Object.values(active_effects).forEach(effect => {
        const statEffects = effect.effects?.stats;

        if (statEffects) {
            for (const [key, value] of Object.entries(statEffects)) {
                if (value.flat !== undefined) {
                    character.stats.flat.active_effect[key] = (character.stats.flat.active_effect[key] || 0) + value.flat;
                }
                if (value.percent !== undefined) {
                    character.stats.percent.active_effect[key] = (character.stats.percent.active_effect[key] || 0) + value.percent;
                }
                if (value.multiplier !== undefined) {
                    character.stats.multiplier.active_effect[key] = (character.stats.multiplier.active_effect[key] || 1) * value.multiplier;
                }
            }
        }

        const immunityEffects = effect.effects?.immunities;
        if (immunityEffects) {
            for (const [type, isImmune] of Object.entries(immunityEffects)) {
                if (isImmune) {
                    character.stats.immunities[type] = true;
                }
            }
        }
    });
};

/**
 * add all stat bonuses from equipment, including def/atk
 * called on equipment changes
 */
character.stats.add_all_equipment_bonus = function() {
        
        //reset as they will be recalculated
        character.stats.flat.equipment = {};
        character.stats.multiplier.equipment = {};

        //iterate over slots
        Object.keys(character.equipment).forEach(slot => {
                if(!character.equipment[slot]) {
                        return;
                }
                
                if(character.equipment[slot].getDefense) {
                        character.stats.flat.equipment.defense = (character.stats.flat.equipment.defense || 0) + character.equipment[slot].getDefense();
                }
                let stats = character.equipment[slot].getStats()

                //iterate over stats in slotted item
                Object.keys(stats).forEach(stat => {
                        if(stats[stat].flat) {
                                character.stats.flat.equipment[stat] = (character.stats.flat.equipment[stat] || 0) + stats[stat].flat;
                        }

                        if(stats[stat].multiplier) {
                                character.stats.multiplier.equipment[stat] = (character.stats.multiplier.equipment[stat] || 1) * stats[stat].multiplier;
                        }
                });
        });

        character.stats.add_weapon_type_bonuses();
        //add weapon speed bonus (technically a bonus related to equipment, so its in this function)
}

character.stats.add_weapon_type_bonuses = function() {
        if(character.equipment.weapon == null) {
                character.stats.multiplier.skills.attack_power = skills["Unarmed"].get_coefficient();
                character.stats.multiplier.skills.attack_speed = (skills["Unarmed"].get_coefficient("multiplicative")**0.3333);
                character.stats.multiplier.skills.attack_points = (skills["Precision"].get_coefficient("multiplicative") || 1) * (skills["Unarmed"].get_coefficient("multiplicative")**0.3333);
        } else {
                character.stats.multiplier.skills.attack_speed = 1;
                character.stats.multiplier.skills.attack_power = skills[weapon_type_to_skill[character.equipment.weapon.weapon_type]].get_coefficient();
                character.stats.multiplier.skills.attack_points = (skills["Precision"].get_coefficient("multiplicative") || 1) * skills[weapon_type_to_skill[character.equipment.weapon.weapon_type]].get_coefficient()**0.3333;
        }
}

/**
 * add all non-milestone stat bonuses from skills
 * called in update_stats()
 * only a few skills really matter here
 */
character.stats.add_all_skill_level_bonus = function() {
        character.stats.flat.skills.defense = skills["Iron skin"].get_level_bonus();
		character.stats.flat.skills.crit_rate = skills["Criticality"].get_level_bonus();
		character.stats.flat.skills.crit_multiplier = skills["Obliteration"].get_level_bonus();
		character.stats.flat.skills.max_health = skills["Gluttony"].get_level_bonus();
		character.stats.flat.skills.max_mana = skills["Mana Expansion"].get_level_bonus();
		character.stats.flat.skills.magic = skills["Magic Mastery"].get_level_bonus() + skills["Spellblade Stance Mastery"].get_level_bonus() + skills["Archmage Stance Mastery"].get_level_bonus();
        character.stats.multiplier.skills.stamina_efficiency = skills["Running"].get_coefficient("multiplicative");
		character.stats.multiplier.skills.intuition = skills["Meditation"].get_coefficient("multiplicative");
		character.stats.multiplier.skills.mana_efficiency = skills["Mana Control"].get_coefficient("multiplicative");
		character.stats.multiplier.skills.magic = skills["Magic Potency"].get_coefficient("multiplicative");
        character.stats.multiplier.skills.strength = skills["Weightlifting"].get_coefficient("multiplicative") *(skills["Breathing"].get_coefficient("multiplicative") || 1) * (skills["Swimming"].get_coefficient("multiplicative") || 1) * (skills["Climbing"].get_coefficient("multiplicative") || 1);
		character.stats.multiplier.skills.max_stamina = skills["Breathing"].get_coefficient("multiplicative") * (skills["Swimming"].get_coefficient("multiplicative") || 1);
        character.stats.multiplier.skills.block_strength = 1 + 5*skills["Shield blocking"].get_level_bonus();
        character.stats.multiplier.skills.agility = skills["Equilibrium"].get_coefficient("multiplicative") * (skills["Breathing"].get_coefficient("multiplicative") || 1) * (skills["Swimming"].get_coefficient("multiplicative") || 1) * (skills["Climbing"].get_coefficient("multiplicative") || 1);
		character.stats.multiplier.skills.dexterity = (skills["Climbing"].get_coefficient("multiplicative") || 1) * (skills["Equilibrium"].get_coefficient("multiplicative") || 1);
		character.stats.multiplier.skills.max_health = skills["Undying"].get_coefficient("multiplicative");
        
        character.stats.add_weapon_type_bonuses();
		
	if(character.stats.full.health < 0.5*(character.stats.full.max_health)) {
        character.stats.flat.skills.defense = skills["Iron skin"].get_level_bonus()+skills["Resilience"].get_level_bonus();
    }

	if(character.stats.full.health < 0.1*(character.stats.full.max_health)) {
       character.stats.flat.skills.strength += skills["Last Stand"].get_level_bonus();
    }

}

/**
 * add all stat bonuses/penalties from stances
 * called in update_stats()
 * multipliers only 
 */
character.stats.add_all_stance_bonus = function() {
        const multipliers = stances[current_stance].getStats();
        Object.keys(character.base_stats).forEach(stat => {
                if(multipliers[stat]) {
                        character.stats.multiplier.stance[stat] = multipliers[stat] || 1;
                        //replacing instead of multiplying, since these come from singular source
                } else {
                        character.stats.multiplier.stance[stat] = 1;
                }
        });
}
/**
 * only supports multiplicative penalties for now
 */
character.stats.add_location_penalties = function() {
        let effects = {};
        let light_modifier = 1;
        
        if(current_location) {
                if(!("connected_locations" in current_location)) {
                        effects = current_location.get_total_effect().hero_penalty;
                }

                if(current_location.light_level === "dark" || current_location.light_level === "normal" && is_night(current_game_time)) {
                        light_modifier = 0.5 + 0.5* get_total_skill_level("Night vision")/skills["Night vision"].max_level;
                        character.stats.multiplier.light_level.evasion_points = light_modifier;
                        character.stats.multiplier.light_level.attack_points = light_modifier;
                } else {
                        character.stats.multiplier.light_level.evasion_points = 1;
                        character.stats.multiplier.light_level.attack_points = 1;
                }
        }

        character.stats.multiplier.environment = {};
        character.stats.flat.environment = {};
        Object.keys(effects.multipliers || {}).forEach(effect => {
                character.stats.multiplier.environment[effect] = effects.multipliers[effect];
        });
        Object.keys(effects.flats || {}).forEach(effect => {
                character.stats.flat.environment[effect] = effects.flats[effect];
        });
}


/**
 * full stat recalculation, call whenever something changes
 */
character.update_stats = function () {
    const missing_health = Math.max((character.stats.full["max_health"] - character.stats.full["health"]), 0) || 0;   
    const missing_stamina = Math.max((character.stats.full["max_stamina"] - character.stats.full["stamina"]), 0) || 0;   
    const missing_mana = Math.max((character.stats.full["max_mana"] - character.stats.full["mana"]), 0) || 0;   
    //to avoid fully restoring all whenever this function is called

    character.stats.add_all_skill_level_bonus();
    character.stats.add_all_stance_bonus();

    Object.keys(character.stats.full).forEach(function(stat){
    let stat_sum = 0;
    let stat_mult = 1;
    let stat_percent = 0;

    if(stat === "block_chance") {
        stat_sum = base_block_chance + Math.round(skills["Shield blocking"].get_level_bonus() * 10000)/10000;
    } else if(stat === "attack_points") {
        stat_sum = Math.sqrt(character.stats.full.intuition) * character.stats.full.dexterity * skills["Combat"].get_coefficient("multiplicative");
    } else if(stat === "evasion_points") {
        stat_sum = character.stats.full.agility * Math.sqrt(character.stats.full.intuition) * skills["Evasion"].get_coefficient("multiplicative");
    } else {
        // Sum all flats
        Object.values(character.stats.flat).forEach(piece => {
            stat_sum += (piece[stat] || 0);
        });

        // Sum all percent effects
        Object.values(character.stats.percent).forEach(piece => {
            stat_percent += (piece[stat] || 0);
        });
    }

    // Multiply all multipliers
    Object.values(character.stats.multiplier).forEach(piece => {
        stat_mult *= (piece[stat] || 1);
    });

    // Calculate full stat
    if (stat.endsWith("_percent")) {
        character.stats.full[stat] = (character.base_stats[stat] || 0) + stat_percent;
        character.stats.total_flat[stat] = character.base_stats[stat] + stat_percent;
        character.stats.total_multiplier[stat] = 1; // Percent stats are not multiplied
    } else {
        character.stats.full[stat] = (character.base_stats[stat] + stat_sum) * stat_mult;
        character.stats.total_flat[stat] =  character.base_stats[stat] + stat_sum;
        character.stats.total_multiplier[stat] = stat_mult || 1;
    }

    // Restore resource values based on max - missing
    if(stat === "health") {
        character.stats.full["health"] = Math.max(1, character.stats.full["max_health"] - missing_health);
    }
    else if(stat === "stamina") {
        character.stats.full["stamina"] = Math.max(0, character.stats.full["max_stamina"] - missing_stamina);
    }
    else if(stat === "mana") {
        character.stats.full["mana"] = Math.max(0, character.stats.full["max_mana"] - missing_mana);
    }
});

     
    if(character.equipment.weapon != null) { 
        character.stats.full.attack_power = (character.stats.full.strength/10) * character.equipment.weapon.getAttack() * character.stats.total_multiplier.attack_power;
    } 
    else {
        character.stats.full.attack_power = (character.stats.full.strength/10) * character.stats.total_multiplier.attack_power;
    }
    
    character.stats.full.magic_power = (character.stats.full.magic) * 10 * character.stats.total_multiplier.magic_power;
		
	character.stats.total_flat.attack_power = character.stats.full.attack_power/character.stats.total_multiplier.attack_power;
	character.stats.total_flat.magic_power = character.stats.full.magic_power/character.stats.total_multiplier.magic_power;

    Object.keys(character.xp_bonuses.total_multiplier).forEach(bonus_target => {
        character.xp_bonuses.total_multiplier[bonus_target] = (character.xp_bonuses.multiplier.levels[bonus_target] || 1) * (character.xp_bonuses.multiplier.skills[bonus_target] || 1) * (character.xp_bonuses.multiplier.books[bonus_target] || 1); 
        //only this two sources as of now

        const bonus = character.xp_bonuses.total_multiplier[bonus_target];

        if(bonus != 1){
                if (bonus_target !== "hero") {
                        if(bonus_target === "all" || bonus_target === "all_skill") {
                                update_all_displayed_skills_xp_gain();
                        } else {
                                update_displayed_skill_xp_gain(skills[bonus_target]);
                        }
                }
                if(bonus_target === "hero" || bonus_target === "all") {
                        update_displayed_xp_bonuses();
                }
        }
    });
}

character.get_stamina_multiplier = function () {
        if(character.stats.full.stamina == 0) {
                return 0.5 + skills["Persistence"].get_level_bonus();
        }
        return 1;
}

character.get_attack_speed = function () {
        let spd = character.stats.full.attack_speed * character.get_stamina_multiplier();
        return spd;
}


character.get_attack_power = function () {
        return character.stats.full.attack_power * character.get_stamina_multiplier();
}

character.get_magic_power = function () {
        return character.stats.full.magic_power;
}

character.wears_armor = function () {
        if(
                (!character.equipment.head || character.equipment.head.getDefense() == 0) &&
                (!character.equipment.torso || character.equipment.torso.getDefense() == 0) &&
                (!character.equipment.arms || character.equipment.arms.getDefense() == 0) &&
                (!character.equipment.legs || character.equipment.legs.getDefense() == 0) &&
                (!character.equipment.feet || character.equipment.feet.getDefense() == 0)
        )
        {
                return false;
        } else {
                return true;
        }
}

/**
 * 
 * @param {*}
 * @returns [actual damage taken; Boolean if character should faint] 
 */
character.take_damage = function ({
    damage_value,
    can_faint = true,
    give_skill_xp = true,
    negate_defense = false,
    pierce = 0, 
}) {
    let fainted;
    let damage_taken;

    if (damage_value < 1) {
        damage_taken = Math.max(Math.ceil(10 * damage_value) / 10, 0);
    } else {
        if (negate_defense) {
            damage_taken = Math.ceil(10 * damage_value) / 10;
        } else {
            const effective_defense = Math.max(0, character.stats.full.defense - pierce); // APPLY PIERCE HERE
            damage_taken = Math.ceil(
                10 * Math.max(damage_value - effective_defense, damage_value * 0.1, 1)
            ) / 10;
        }
    }

    character.stats.full.health -= damage_taken;

    if (character.stats.full.health <= 0 && can_faint) {
        fainted = true;
        character.stats.full.health = 0;
    } else {
        fainted = false;
    }

    return { damage_taken, fainted };
};

character.get_character_money = function () {
        return character.money;
}

/**
 * @param {Array} items [{item, count},...] 
 */
function add_to_character_inventory(items) {
        const was_anything_new_added = character.add_to_inventory(items);
        for(let i = 0; i < items.length; i++) {
                if(items[i].item.tags.tool && character.equipment[items[i].item.equip_slot] === null) {
                        equip_item_from_inventory(items[i].item.getInventoryKey());
                }
        }
        update_displayed_character_inventory({was_anything_new_added});
}

/**
 * Removes items from character's inventory
 * Takes an array in form of [{item_key, item_count}]
 */
function remove_from_character_inventory(items) {
        character.remove_from_inventory(items);
        update_displayed_character_inventory();

        for(let i = 0; i < items.length; i++) {
                if(character.inventory[items[i].item_key]) {
                        continue;
                }
                const {id} = JSON.parse(items[i].item_key);
                if(id && item_templates[id].tags.usable && favourite_consumables[id]) {
                        remove_consumable_from_favourites(id);
                }
        }
}

/**
 * @description equips passed item, doesn't do anything more with it;
 * don't call this one directly (except for when loading save data), but via equip_item_from_inventory()
 * @param: game item object
 */
function equip_item(item) {
        if(item) {
                unequip_item(item.equip_slot);
                character.equipment[item.equip_slot] = item;
        }
        update_displayed_equipment();
        update_displayed_character_inventory();
        character.stats.add_all_equipment_bonus();
        
        update_character_stats();
}

/**
 * equips item and removes it from inventory
 * @param item_key
 **/
 function equip_item_from_inventory(item_key) {
        if(item_key in character.inventory) { //check if its in inventory, just in case
            //add specific item to equipment slot
            // -> id and name tell which exactly item it is, then also check slot in item object and thats all whats needed
            equip_item(character.inventory[item_key].item);
            remove_from_character_inventory([{item_key}]);
            
            update_character_stats();
        }
}
    
function unequip_item(item_slot) {
        if(character.equipment[item_slot] != null) {
                add_to_character_inventory([{item: character.equipment[item_slot]}]);
                character.equipment[item_slot] = null;
                update_displayed_equipment();
                update_displayed_character_inventory();
                character.stats.add_all_equipment_bonus();

                update_character_stats();
        }
}

function add_location_penalties() {
        character.stats.add_location_penalties();
}


/**
 * updates character stats + their display 
 */
function update_character_stats() {
        character.stats.add_location_penalties();
        character.update_stats();

        update_displayed_stats();
        update_displayed_health();
        update_displayed_stamina();
        
        update_displayed_mana();
}

/**
 * updates character stats related to combat, things that are more situational and/or based on other stats, kept separately from them
 */

function get_skill_xp_gain(skill_name) {
        return (character.xp_bonuses.total_multiplier.all_skill || 1) * (character.xp_bonuses.total_multiplier.all || 1) * (character.xp_bonuses.total_multiplier[skill_name] || 1) * (skills["Fate Mastery"].get_coefficient("multiplicative") || 1);
}

function get_skills_overall_xp_gain() {
        return (character.xp_bonuses.total_multiplier.all_skill || 1) * (character.xp_bonuses.total_multiplier.all || 1) * (skills["Fate Mastery"].get_coefficient("multiplicative") || 1);
}

function get_hero_xp_gain() {
        return (character.xp_bonuses.total_multiplier.hero || 1) * (character.xp_bonuses.total_multiplier.all || 1) * (skills["Destiny Mastery"].get_coefficient("multiplicative") || 1);
}

function get_total_skill_level(skill_id) {
        return skills[skill_id].current_level + (character.bonus_skill_levels.full[skill_id] || 0);
}

function get_total_level_bonus(skill_id) {
        return skills[skill_id].get_level_bonus(get_total_skill_level(skill_id));
}

function get_total_skill_coefficient({scaling_type, skill_id}) {
        return skills[skill_id].get_coefficient({scaling_type, skill_level: get_total_skill_level(skill_id)});
}

function get_effect_with_bonuses(active_effect) {
        let multiplier = 1;
        if(active_effect.tags.medicine) {
                multiplier *= get_total_skill_coefficient({scaling_type: "multiplicative", skill_id:"Medicine"});
        }
        let boosted = {stats: {}, bonus_skill_levels: {...active_effect.effects.bonus_skill_levels}};
        for(const [key, value] of Object.entries(active_effect.effects.stats)) {
                boosted.stats[key] = {};
                if(value.flat && key.includes("_flat")) {
                        boosted.stats[key].flat = value.flat*multiplier**2;
                }
                if(value.flat && key.includes("_percent")) {
                        //this exclusively means percent based regeneration and is therefore treated as multiplicative effect
                        boosted.stats[key].flat = value.flat*multiplier;
                }
                if(value.multiplier) {
                        boosted.stats[key].multiplier = value.multiplier*multiplier;
                }      
        }

        return boosted;
}


export {character, add_to_character_inventory, remove_from_character_inventory, equip_item_from_inventory, equip_item, 
        unequip_item, update_character_stats, get_skill_xp_gain, get_hero_xp_gain, get_skills_overall_xp_gain, add_location_penalties, get_total_skill_level, get_total_level_bonus, get_total_skill_coefficient, get_effect_with_bonuses};
