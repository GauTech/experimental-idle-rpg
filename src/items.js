"use strict";

/*
    item_templates contain some predefined equipment for easier access (instead of having to create them with proper components each time)

    equippable are unstackable, other items stack

    item quality translates into rarity, but also provides another multiplier on top of quality multiplier, starting at uncommon
            quality     rarity         color      additional_multiplier
            0-49%       trash          gray       x1
            50-99%      common         white      x1
            100-129%    uncommon       green      x1.1
            130-159%    rare           blue       x1.3
            160-199%    epic           purple     x1.6
            200-246%    legendary      orange     x2
            247-250%    mythical       ????       x2.5

            quality affects only attack/defense/max block, while additional multiplier affects all positive stats 
            (i.e flat bonuses over 0 and multiplicative bonuses over 1)

    basic idea for weapons:

        short blades (daggers/spears) are the fastest but also the weakest, +the most crit rate and crit damage
        blunt heads (blunt weapons) have highest damage, but also lower attack speed
        axe heads have a bit less damage, but a bit less attack speed penalty
        long blades (swords/spears?) have average damage and average attack speed

        long handles (spears) have higher attack multiplier and lower attack speed (so they counter the effects of the short blades)
        medium handles (axes/blunt weapons) have them average
        short handles have lowest attack multiplier
        
        so, as a result, attack damage goes blunt > axe > spear > sword > dagger
        and attack speed goes               dagger > sword > spear > axe > blunt
        which kinda makes spears very average, but they also get bonus crit so whatever
*/

import { character } from "./character.js";
import { round_item_price } from "./misc.js";

const rarity_multipliers = {
    trash: 1, //low quality alone makes these so bad that no additional nerf should be needed
    common: 1,
    uncommon: 1.1,
    rare: 1.3,
    epic: 1.6,
    legendary: 2,
    mythical: 2.5
};

const item_templates = {};


///chance is handled in rolling the loot_pool in the first place, so these should always have 100% chance.
const loot_pools = {
    magic_spellbooks_pool: [
        { item_id: "TRUE ULTIMATE POWER", chance: 100, min_count: 1, max_count: 1 },
        { item_id: "Old combat manual", chance: 100, min_count: 1, max_count: 1 },
        { item_id: "The Spellblade Chronicles vol. 1", chance: 100, min_count: 1, max_count: 1 },
		{ item_id: "Muscle Wizard Adventures", chance: 100, min_count: 1, max_count: 1 },
		{ item_id: "Basic Barrier Magic", chance: 100, min_count: 1, max_count: 1 },
		{ item_id: "Practical Applications of Time Travel", chance: 100, min_count: 1, max_count: 1 },
		
		
    ],
    // other pools...
};

let loot_sold_count = {};

function setLootSoldCount(data) {
    loot_sold_count = data;
}

function recoverItemPrices(count=1) {
    Object.keys(loot_sold_count).forEach(item_name => {

        if(!item_templates[item_name].price_recovers) {
            return;
        }

        loot_sold_count[item_name].recovered += count;
        
        if(loot_sold_count[item_name].recovered > loot_sold_count[item_name].sold) {
            loot_sold_count[item_name].recovered = loot_sold_count[item_name].sold;
        }
    })
}

function getLootPriceModifier(value, how_many_sold) {
    let modifier = 1;
    if(how_many_sold >= 999) {
        modifier = 0.1;
    } else if(how_many_sold) {
        modifier = modifier * 111/(111+how_many_sold);
    }
    return Math.round(value*modifier)/value;
}

/**
 * 
 * @param {Number} value
 * @param {Number} start_count 
 * @param {Number} how_many_to_sell 
 * @returns 
 */
function getLootPriceModifierMultiple(value, start_count, how_many_to_sell) {
    let sum = 0;
    for(let i = start_count; i < start_count+how_many_to_sell; i++) {
        /*
        rounding is necessary to make it be a proper fraction of the value
        otherwise, there might be cases where trading too much of an item results in small deviation from what it should be
        */
        sum += getLootPriceModifier(value, i);
    }
    return sum;
}

function getArmorSlot(internal) {
    let equip_slot;
    if(item_templates[internal].component_type === "helmet interior") {
        equip_slot = "head";
    } else if(item_templates[internal].component_type === "chestplate interior") {
        equip_slot = "torso";
    } else if(item_templates[internal].component_type === "leg armor interior") {
        equip_slot = "legs";
    } else if(item_templates[internal].component_type === "glove interior") {
        equip_slot = "arms";
    } else if(item_templates[internal].component_type === "shoes interior") {
        equip_slot = "feet";
    } else {
        console.error(`Component type "${item_templates[internal].component_type}" doesn't correspond to any armor slot!`);
        return null;
    }
    return equip_slot;
}

function getItemRarity(quality) {
    let rarity;
    if(quality < 50) rarity =  "trash";
    else if(quality < 100) rarity = "common";
    else if(quality < 130) rarity = "uncommon";
    else if(quality < 160) rarity = "rare";
    else if(quality < 200) rarity = "epic";
    else if(quality < 246) rarity = "legendary";
    else rarity = "mythical";
    
    return rarity;
}

function getEquipmentValue(components, quality) {
    let value = 0;
    Object.values(components).forEach(component => {
        value += item_templates[component].value;
    });
    return round_item_price(value * (quality/100 ) * rarity_multipliers[getItemRarity(quality)]);
}

class Item {
    constructor({name,
                description,
                value = 0,
                tags = {},
                id = null,
				gluttony_value = 0,
				mana_value = 0,
                })
    {
        this.name = name; 
        this.description = description;
        this.saturates_market = false;
        this.id = id;
        /**
         * Use .getValue() instead of this
         */
        this.value = value;
        this.tags = tags;
        this.tags["item"] = true;
		this.gluttony_value = gluttony_value;
		this.mana_value = mana_value;
    }

    getInventoryKey() {
        if(!this.inventory_key) {
            this.inventory_key = this.createInventoryKey();
        }
        return this.inventory_key;
    }

    createInventoryKey() {
        const key = {};

        if(!this.components) {
            key.id = this.id;
        } else {
            key.components = {};
            Object.keys(this.components).forEach(component => {
                key.components[component] = this.components[component];
            });
        }
        if(this.quality) {
            key.quality = this.quality;
        }
        return JSON.stringify(key);
    }

    getValue() {
        if(!this.saturates_market) {
            return round_item_price(this.value);
        }
        else {  
            return Math.max(1, round_item_price(Math.ceil(this.value * getLootPriceModifier(this.value,(Math.max(loot_sold_count[this.id]?.sold - loot_sold_count[this.id]?.recovered,0)||0)))));
        }
    }

    getBaseValue() {
        return this.value;
    }

    getValueOfMultiple({additional_count_of_sold = 0, count}) {
        if(!this.saturates_market) {
            return round_item_price(this.value) * count;
        }
        else {
            const modifier = getLootPriceModifierMultiple(this.value, (Math.max(loot_sold_count[this.id]?.sold - loot_sold_count[this.id]?.recovered,0)||0)+additional_count_of_sold, count);
            return Math.max(count, Math.ceil(round_item_price(this.value) * Math.round(this.value*modifier)/this.value));
        }
    }

    getName() {
        return this.name;
    }

    getDescription() {
        return this.description;
    }
}

class OtherItem extends Item {
    constructor(item_data) {
        super(item_data);
        this.item_type = "OTHER";
        this.stackable = true;
        this.saturates_market = item_data.saturates_market;
        this.price_recovers = item_data.price_recovers;
    }
}

class Material extends OtherItem {
    constructor(item_data) {
        super(item_data);
        this.item_type = "MATERIAL";
        this.saturates_market = true;
        this.price_recovers = true;
        this.material_type = item_data.material_type;
        this.tags["material"] = true;
    }
}

class Junk extends OtherItem {
    constructor(item_data) {
        super(item_data);
        this.item_type = "JUNK";
        this.saturates_market = true;
        this.price_recovers = true;
        this.tags["junk"] = true;
    }
}

class KeyItem extends OtherItem {
    constructor(item_data) {
        super(item_data);
        this.item_type = "KEYITEM";
        this.saturates_market = true;
        this.price_recovers = true;
        this.tags["keyitem"] = true;
    }
}

class ItemComponent extends Item {
    constructor(item_data) {
        super(item_data);
        this.item_type = "COMPONENT";
        this.stackable = false;
        this.component_tier = item_data.component_tier || 1;
        this.stats = item_data.stats || {};
		this.component_stats = item_data.component_stats || {};
        this.tags["equipment component"] = true;
        this.quality = Math.round(item_data.quality) || 100;
    }
    getRarity(quality){
        if(!quality) {
            if(!this.rarity) {
                this.rarity = getItemRarity(this.quality);
            }
            return this.rarity;
        } else {
            return getItemRarity(quality);
        }

    }

    calculateRarity(quality) {
        let rarity;
        if(quality < 50) rarity =  "trash";
        else if(quality < 100) rarity = "common";
        else if(quality < 130) rarity = "uncommon";
        else if(quality < 160) rarity = "rare";
        else if(quality < 200) rarity = "epic";
        else if(quality < 246) rarity = "legendary";
        else rarity = "mythical";
        
        return rarity;
    }

    getStats() {
        return this.stats;
    }

    getValue(quality) {
        return round_item_price(this.value * (quality/100 || this.quality/100));
    } 
}

class WeaponComponent extends ItemComponent {
    constructor(item_data) {
        super(item_data);
        if(item_data.component_type !== "axe head" && item_data.component_type !== "hammer head"
        && item_data.component_type !== "short blade" && item_data.component_type !== "long blade"
        && item_data.component_type !== "short handle" && item_data.component_type !== "long handle"
        && item_data.component_type !== "medium handle") {
            throw new Error(`No such weapon component type as ${item_data.component_type}`);
        }
        this.component_type = item_data.component_type;
		this.component_stats = item_data.component_stats || {};
        //"short blade", "long blade", "axe blade", "hammer blade" for heads; "short handle", "medium handle", "long handle" for handles

        this.attack_value = item_data.attack_value || 0; //can skip this for weapon handles
        if(item_data.component_type === "short handle"){
            this.attack_multiplier = 1;
        } else if(item_data.component_type === "medium handle"){
            this.attack_multiplier = 1;
        } else if(item_data.component_type === "long handle"){
            this.attack_multiplier = 1.5;
        } else {
            this.attack_multiplier = 1;
        }

        this.name_prefix = item_data.name_prefix; //to create a name of an item, e.g. "Sharp iron" used to create spear results in "Sharp iron spear"
		this.name_override = item_data.name_override; //override to make a complete item name

        this.tags["weapon component"] = true;
        this.tags["component"] = true;
    }
}

class ShieldComponent extends ItemComponent {
    constructor(item_data) {
        super(item_data);
        if(item_data.component_type !== "shield base" && item_data.component_type !== "shield handle") {
            throw new Error(`No such shield component type as ${item_data.component_type}`);
        }
        this.component_type = item_data.component_type;
		this.component_stats = item_data.component_stats || {};

        //properties below only matter for shield type component
        this.shield_strength = item_data.shield_strength; 
        this.shield_name = item_data.shield_name || item_data.name;

        this.tags["shield component"] = true;
        this.tags["component"] = true;
    }
}

class ArmorComponent extends ItemComponent {
    constructor(item_data) {
        super(item_data);
        if(item_data.component_type !== "helmet interior" && item_data.component_type !== "helmet exterior"
        && item_data.component_type !== "chestplate interior" && item_data.component_type !== "chestplate exterior"
        && item_data.component_type !== "leg armor interior" && item_data.component_type !== "leg armor exterior"
        && item_data.component_type !== "glove interior" && item_data.component_type !== "glove exterior"
        && item_data.component_type !== "shoes interior" && item_data.component_type !== "shoes exterior") {

            throw new Error(`No such armor component type as ${item_data.component_type}`);
        }
        this.component_type = item_data.component_type;
		this.component_stats = item_data.component_stats || {};
        this.defense_value = item_data.defense_value;

        this.stats = item_data.stats || {};

        this.equip_slot = item_data.equip_slot;

        //only used with external elements
        this.full_armor_name = item_data.full_armor_name;

        //only used with internal elements
        this.armor_name = item_data.armor_name;

        //only used with external elements; name_prefix/name_suffix are used only if full_armor_name is not provided
        this.name_prefix = item_data.name_prefix;
        this.name_suffix = item_data.name_suffix;

        this.tags["armor component"] = true;
        this.tags["component"] = true;
    }
}

class UsableItem extends Item {
    constructor(item_data) {
        super(item_data);
        this.item_type = "USABLE";
        this.stackable = true;
        this.effects = item_data.effects || {};
		this.cures = item_data.cures || [];
		this.elixir_bonus = item_data.elixir_bonus;
		this.instant_health_recovery = item_data.instant_health_recovery;

        this.tags["usable"] = true;
    }
}

class Equippable extends Item {
    constructor(item_data) {
        super(item_data);
        this.item_type = "EQUIPPABLE";
        this.stackable = false;
        this.components = {};

        this.quality = Math.round(item_data.quality) || 100;

        this.tags["equippable"] = true;
    }

    getValue(quality) {
        return round_item_price(this.value * (quality || this.quality));
    } 

    getRarity(quality){
        if(!quality) {
            if(!this.rarity) {
                this.rarity = getItemRarity(this.quality);
            }
            return this.rarity;
        } else {
            return getItemRarity(quality);
        }

    }

    getStats(quality){
        if(!quality) {
            if(!this.stats) {
                this.stats = this.calculateStats(this.quality);
            }
            return this.stats;
        } else {
            return this.calculateStats(quality);
        }
    }

    calculateStats(quality){
     const stats = {};
        if(this.components) {
            //iterate over components
			//console.log("this.components:", this.components);
            const components = Object.values(this.components).map(comp => item_templates[comp]).filter(comp => comp);
			Object.values(this.components).forEach(id => {
    if (!item_templates[id]) console.warn("Missing item_template for:", id);
});
	for (let i = 0; i < components.length; i++) {
		const compStats = components[i].component_stats;
		if (!compStats || typeof compStats !== "object")  continue; // SAFETY CHECK console.log(compStats); console.log(components);
		
		//console.log(compStats); console.log(components);
		Object.keys(compStats).forEach(stat => {
			if (!stats[stat]) stats[stat] = {};

			if (["defense", "attack_power", "block_strength"].includes(stat)) return;

			if (compStats[stat].multiplier) {
				stats[stat].multiplier = (stats[stat].multiplier || 1) * compStats[stat].multiplier;
			}
			if (compStats[stat].flat) {
				stats[stat].flat = (stats[stat].flat || 0) + compStats[stat].flat;
			}
		});
	}

            //iterate over stats and apply rarity bonus if possible
            Object.keys(stats).forEach(stat => {
                if(stats[stat].multiplier){
                    if(stats[stat].multiplier >= 1) {
                        stats[stat].multiplier = Math.round(100 * (1 + (stats[stat].multiplier - 1) * rarity_multipliers[this.getRarity(quality)]))/100;
                    } else {
                        stats[stat].multiplier = Math.round(100 * stats[stat].multiplier)/100;
                    }
                }

                if(stats[stat].flat){
                    if(stats[stat].flat > 0) {
                        stats[stat].flat = Math.round(100 * stats[stat].flat * rarity_multipliers[this.getRarity(quality)])/100;
                    } else {
                        stats[stat].flat = Math.round(100 * stats[stat].flat)/100;
                    }
                }
            });
        } else { //no components, only needs to apply quality to already present stats
            Object.keys(this.stats).forEach(stat => {
                stats[stat] = {};
                if(this.stats[stat].multiplier){
                    stats[stat].multiplier = 1;
                    if(this.stats[stat].multiplier >= 1) {
                        stats[stat].multiplier = Math.round(100 * (1 + (this.stats[stat].multiplier - 1) * rarity_multipliers[this.getRarity(quality)]))/100;
                    } else {
                        stats[stat].multiplier = Math.round(100 * this.stats[stat].multiplier)/100;
                    }
                }

                if(this.stats[stat].flat){
                    stats[stat].flat = 0;
                    if(this.stats[stat].flat > 0) {
                        stats[stat].flat = Math.round(100 * this.stats[stat].flat * rarity_multipliers[this.getRarity(quality)])/100;
                    } else {
                        stats[stat].flat = Math.round(100 * this.stats[stat].flat)/100;
                    }
                }
            });
        }

        return stats;
    }
	
	
}

class Artifact extends Equippable {
    constructor(item_data) {
        super(item_data);
        this.components = undefined;
        this.equip_slot = "artifact";
        this.stats = item_data.stats;

        this.tags["artifact"] = true;
        if(!this.id) {
            this.id = this.getName();
        }
    }

    getValue() {
        return this.value;
    } 

    getStats(){
        return this.stats;
    }
}

class Tool extends Equippable {
    constructor(item_data) {
        super(item_data);
        this.equip_slot = item_data.equip_slot; //tool type is same as equip slot (axe/pickaxe/herb sickle)
		this.tool_bonus = item_data.tool_bonus;
        this.components = undefined;
        this.tags["tool"] = true;
        this.tags[this.equip_slot] = true;
        if(!this.id) {
            this.id = this.getName();
        }
    }
    getStats() {
        return {};
    }

    getValue() {
        return this.value;
    } 
}

class Shield extends Equippable {
    constructor(item_data) {
        super(item_data);
        this.equip_slot = "off-hand";
        this.offhand_type = "shield"; //not like there's any other option

        if(!item_templates[item_data.components.shield_base]) {
            throw new Error(`No such shield base component as: ${item_data.components.shield_base}`);
        }
        this.components.shield_base = item_data.components.shield_base; //only the name

        if(item_data.components.handle && !item_templates[item_data.components.handle]) {
            throw new Error(`No such shield handle component as: ${item_data.components.handle}`);
        }
        this.components.handle = item_data.components.handle; //only the name
        this.tags["shield"] = true;
        if(!this.id) {
            this.id = this.getName();
        }
    }

    getShieldStrength(quality) {
        if(!quality) {
            if(!this.shield_strength) {
                this.shield_strength = this.calculateShieldStrength(this.quality);
            }
            return this.shield_strength;
        } else {
            return this.calculateShieldStrength(quality);
        }
    }

    calculateShieldStrength(quality) {
        return Math.round(10 * Math.ceil(item_templates[this.components.shield_base].shield_strength * (quality/100) * rarity_multipliers[this.getRarity(quality)]))/10;
    }

    getName() {
        return item_templates[this.components.shield_base].shield_name;
    }

    getValue(quality) {
        if(!this.value) {
            //value of shield base + value of handle, both multiplied by quality and rarity
            this.value = (item_templates[this.components.shield_base].value + item_templates[this.components.handle].value)
                                  * (quality/100 || this.quality/100) * rarity_multipliers[this.getRarity(quality)];
        }
        return round_item_price(this.value);
    } 
}

class Armor extends Equippable {
    /*
        can be componentless, effectively being an equippable internal part

        naming convention:
        if full_armor_name in external
            then full_armor_name
        else use prefix and suffix on internal element
    */
   /**
    * Takes either {components} or {stats}, with {components} having higher priority. Lack of {components} assumes item is a wearable internal part (clothing)
    * @param {*} item_data 
    */
    constructor(item_data) {
        super(item_data);
        
        if(item_data.components) {
            if(!item_templates[item_data.components.internal]) {
                throw new Error(`No such internal armor element as: ${item_data.components.internal}`);
            }

            this.components.internal = item_data.components.internal; //only the name
            this.components.external = item_data.components.external; //only the name
			

            if(item_templates[this.components.internal].component_type === "helmet interior") {
                this.equip_slot = "head";
            } else if(item_templates[this.components.internal].component_type === "chestplate interior") {
                this.equip_slot = "torso";
            } else if(item_templates[this.components.internal].component_type === "leg armor interior") {
                this.equip_slot = "legs";
            } else if(item_templates[this.components.internal].component_type === "glove interior") {
                this.equip_slot = "arms";
            } else if(item_templates[this.components.internal].component_type === "shoes interior") {
                this.equip_slot = "feet";
            } else {
                throw new Error(`Component type "${item_templates[this.components.internal].component_type}" doesn't correspond to any armor slot!`);
            }
            if(item_data.external && !item_templates[item_data.external]) {
                throw new Error(`No such external armor element as: ${item_data.components.external}`);
            }
            
        } else { 
            this.tags["armor component"] = true;
            this.tags["clothing"] = true;
            this.stats = item_data.stats || {};
            delete this.components;
            
            if(!item_data.name) {
                throw new Error(`Component-less item needs to be provided a name!`);
            }
            this.name = item_data.name;
            if(!item_data.value) {
                throw new Error(`Component-less item "${this.getName()}" needs to be provided a monetary value!`);
            }

            this.component_type = item_data.component_type;
            this.value = item_data.value;
            this.component_tier = item_data.component_tier || 1;
            this.base_defense = item_data.base_defense;

            if(item_data.component_type === "helmet interior") {
                this.equip_slot = "head";
            } else if(item_data.component_type === "chestplate interior") {
                this.equip_slot = "torso";
            } else if(item_data.component_type === "leg armor interior") {
                this.equip_slot = "legs";
            } else if(item_data.component_type === "glove interior") {
                this.equip_slot = "arms";
            } else if(item_data.component_type === "shoes interior") {
                this.equip_slot = "feet";
            } else {
                throw new Error(`Component type "${item_data.component_type}" doesn't correspond to any armor slot!`);
            }
        }

        this.tags["armor"] = true;
        if(!this.id) {
            this.id = this.getName();
        }
    }

    getDefense(quality) {
        if(!quality) {
            if(!this.defense_value) {
                this.defense_value = this.calculateDefense(this.quality);
            }
            return this.defense_value;
        } else {
            return this.calculateDefense(quality);
        }
    }
    calculateDefense(quality) {
        if(this.components) {
            return Math.ceil(((item_templates[this.components.internal].defense_value || item_templates[this.components.internal].base_defense ||0) + 
                                        (item_templates[this.components.external]?.defense_value || 0 )) 
                                        * (quality/100 || this.quality/100) * rarity_multipliers[this.getRarity(quality || this.quality)]
            )
        } else {
            return Math.ceil((this.base_defense || 0)  * (quality/100 || this.quality/100) * rarity_multipliers[this.getRarity(quality || this.quality)]);
        }
    }

    getValue(quality) {
        
        if(this.components) {
            //value of internal + value of external (if present), both multiplied by quality and rarity
            return round_item_price((item_templates[this.components.internal].value + (item_templates[this.components.external]?.value || 0))
                            * (quality/100 || this.quality/100) * rarity_multipliers[this.getRarity(quality)]);
        } else {
            return round_item_price(item_templates[this.id].value * (quality/100 || this.quality/100) * rarity_multipliers[this.getRarity(quality)]);
        }
    } 

    getName() {
        /*
        no external => name after internal.armor_name
        external with full_armor_name => use full_armor_name
        otherwise => prefix + internal + suffix
        */

        if(!this.name) {
            if(!this.components.external) {
                this.name = item_templates[this.components.internal].armor_name;
            } else {
                if(item_templates[this.components.external].full_armor_name) {
                    this.name = item_templates[this.components.external].full_armor_name;
                } else {
                    this.name = (item_templates[this.components.external].name_prefix || '') + " " + item_templates[this.components.internal].armor_name.toLowerCase() + " " + (item_templates[this.components.external].name_suffix || '');
                }
            }
        }

        return this.name;
    }
}

class Weapon extends Equippable {
    constructor(item_data) {
        super(item_data);
        this.equip_slot = "weapon";

        if(!item_templates[item_data.components.head]) {
            throw new Error(`No such weapon head as: ${item_data.components.head}`);
        }
        this.components.head = item_data.components.head; //only the name
		const name = item_data.id;
		
		this.special_effects = item_data.special_effects || [];
		
			/*		special_effects: [  // <-- Defined once in the template
			{ name: "greed", value: 1 }, gain 1 money on enemy kill
			{ name: "leech", value: 5 }, gain 5 hp on enemy kill
			{ name: "siphon", value: 1 }, gain 1 mana on enemy kill
		]*/

        if(!item_templates[item_data.components.handle]) {
            throw new Error(`No such weapon handle as: ${item_data.components.handle}`);
        }
        this.components.handle = item_data.components.handle; //only the name

        if(item_templates[this.components.handle].component_type === "long handle" 
        && (item_templates[this.components.head].component_type === "short blade" || item_templates[this.components.head].component_type === "long blade")) {
            //long handle + short/long blade = spear
            this.weapon_type = "spear";
        } else if(item_templates[this.components.handle].component_type === "medium handle" 
        && item_templates[this.components.head].component_type === "axe head") {
            //medium handle + axe head = axe
            this.weapon_type = "axe";
        } else if(item_templates[this.components.handle].component_type === "medium handle" 
        && item_templates[this.components.head].component_type === "hammer head") {
            //medium handle + hammer head = hammer
            this.weapon_type = "hammer";
        } else if(item_templates[this.components.handle].component_type === "short handle" 
        && item_templates[this.components.head].component_type === "short blade") {
            //short handle + short blade = dagger
            this.weapon_type = "dagger";
        } else if(item_templates[this.components.handle].component_type === "short handle" 
        && item_templates[this.components.head].component_type === "long blade") {
            //short handle + long blade = sword
            this.weapon_type = "sword";
        } else {
            throw new Error(`Combination of elements of types ${item_templates[this.components.handle].component_type} and ${item_templates[this.components.head].component_type} does not exist!`);
        }

        this.tags["weapon"] = true;
        this.tags[this.weapon_type] = true;
		
        if(!this.id) {
            this.id = this.getName();
        }
    }

    getAttack(quality){
        if(!quality) {
            if(!this.attack_power) {
                this.attack_power = this.calculateAttackPower(this.quality);
            }
            return this.attack_power;
        } else {
            return this.calculateAttackPower(quality);
        }
    }

    calculateAttackPower(quality) {
        return Math.ceil(
            (item_templates[this.components.head].attack_value + item_templates[this.components.handle].attack_value)
            * item_templates[this.components.head].attack_multiplier * item_templates[this.components.handle].attack_multiplier
            * (item_templates[this.components.head].stats?.attack_power?.multiplier || 1) * (item_templates[this.components.handle].stats?.attack_power?.multiplier || 1)
            * (quality/100) * rarity_multipliers[this.getRarity(quality)]
        );
    }

    getValue(quality) {
        if(!this.value) {
            //value of handle + value of head, both multiplied by quality and rarity
            this.value = (item_templates[this.components.handle].value + item_templates[this.components.head].value) * (quality/100 || this.quality/100) * rarity_multipliers[this.getRarity(quality)]
        }
        return round_item_price(this.value);
    } 
		
    getName() {
		if (item_templates[this.components.head].name_override) {
			const override = item_templates[this.components.head].name_override;
			
			if (typeof override === 'string') {
				return override;
			}
			else if (typeof override === 'object') {
				// Object format: {default: "Name", dagger: "Ducat Dirk", spear: "Gilded Glaive"}
				if (this.weapon_type && override[this.weapon_type]) {
					return override[this.weapon_type];
				}
				return override.default || '';
			}
			return '';
		} else {
				
        return `${item_templates[this.components.head].name_prefix} ${this.weapon_type === "hammer" ? "battle hammer" : this.weapon_type}`;
    }
	}
}

//////////////////////////////
//////////////////////////////
//////////////////////////////
class BookData{
    constructor({
        required_time = 1,
        required_skills = {literacy: 0},
        literacy_xp_rate = 1,
        finish_reward = {},
        rewards = {},
		repeat_rewards = {},
		unlocks = {},
    }) {
        this.required_time = required_time;
        this.accumulated_time = 0;
        this.required_skills = required_skills;
        this.literacy_xp_rate = literacy_xp_rate;
        this.finish_reward = finish_reward;
        this.is_finished = false;
        this.rewards = rewards; // unlocks should be in the format 		unlock_stance: "protect", unlock_magic: "Ice Beam", etc
		this.repeat_rewards = repeat_rewards; // skill_xp rewards for repeating the book milesone
		this.unlocks = unlocks;
    }
}

const book_stats = {};


class Book extends Item {
    constructor(item_data) {
        super(item_data);
        this.stackable = true;
        this.item_type = "BOOK";
        this.name = item_data.name;

        this.tags["book"] = true;
    }

    /**
     * 
     * @returns {Number} total time needed to read the book
     */
    getReadingTime() {
        //maybe make it go faster with literacy skill level?
        let {required_time} = book_stats[this.name];
        return required_time;
    }

    /**
     * 
     * @returns {Number} remaining time needed to read the book (total time minus accumulated time)
     */
    getRemainingTime() {
        let remaining_time = Math.max(book_stats[this.name].required_time - book_stats[this.name].accumulated_time, 0);
        return remaining_time;
    }
	


		addProgress(time = 1) {
			book_stats[this.name].accumulated_time += time;
			if (book_stats[this.name].accumulated_time >= book_stats[this.name].required_time) {
				this.setAsFinished(); // no argument = fromSave is false
			}
		}

				setAsFinished(fromSave = false) {
			book_stats[this.name].is_finished = true;
			book_stats[this.name].accumulated_time = book_stats[this.name].required_time;

			// Pass `apply_unlocks = !fromSave`
			character.stats.add_book_bonus(book_stats[this.name].rewards, !fromSave);
}
}

function getAdjustedReadingTime(bookTitle) {
    const book = item_templates[bookTitle];
    const required = book_stats[book.name].required_time;
    const accumulated = book_stats[book.name].accumulated_time;

    if (accumulated <= required) {
        return required - accumulated;
    } else {
        return required - (accumulated % required);
    }
}

/**
 * lootchest clase setup 
 * 
 */


class LootChestItem extends UsableItem {
    constructor(item_data) {
        super(item_data);
		this.loot_pool = item_data.loot_pool;
        this.loot = item_data.loot || []; // Array of { item_id, chance, min_count, max_count }
        this.tags["loot_chest"] = true;
    }
}


/**
 * @param {*} item_data 
 * @returns item of proper type, created with item_data
 */
function getItem(item_data) {
    switch (item_data.item_type) {
        case "EQUIPPABLE":
            switch (item_data.equip_slot) {
                case "weapon":
                    return new Weapon(item_data);
                case "off-hand":
                    return new Shield(item_data);
                case "artifact":
                    return new Artifact(item_data);
                case "axe":
                case "pickaxe":
                case "sickle":
                case "rod":
                    return new Tool(item_data);
                default:
                    return new Armor(item_data);
            }
        case "USABLE":
            if (item_data.tags?.loot_chest) {
                return new LootChestItem(item_data);
            }
            return new UsableItem(item_data);
        case "BOOK":
            return new Book(item_data);
        case "OTHER":
            return new OtherItem(item_data);
		case "JUNK":
            return new Junk(item_data);
			case "KEYITEM":
            return new KeyItem(item_data);
        case "COMPONENT":
            if (item_data.tags["weapon component"])
                return new WeaponComponent(item_data);
            else if (item_data.tags["armor component"])
                return new ArmorComponent(item_data);
            else if (item_data.tags["shield component"])
                return new ShieldComponent(item_data);
            else throw new Error(`Item ${item_data.name} has a wrong component type`);
        case "MATERIAL":
            return new Material(item_data);
        default:
            throw new Error(`Wrong item type: ${item_data.item_type}`);
    }
}

function getItemFromKey(key) {
    let {id, components, quality} = JSON.parse(key);
    if(id && !quality) { 
        if(item_templates[id]) {
            return getItem(item_templates[id]);
        } else {
            throw new Error(`Inventory item "${key}" couldn't be found!`);
        }
    } else if(components) {
        const {head, handle, shield_base, internal, external} = components;
        if(head) { //weapon
            if(!item_templates[head]){
                throw new Error(`Weapon head component "${head}" couldn't be found!`);
            } else if(!item_templates[handle]) {
                throw new Error(`Weapon handle component "${handle}" couldn't be found!`);
            } else {
                return getItem({components, quality, equip_slot: "weapon", item_type: "EQUIPPABLE"});
            }
        } else if(shield_base){ //shield
            if(!item_templates[shield_base]){
                throw new Error(`Shield base component "${shield_base}" couldn't be found!`);
            } else if(!item_templates[handle]) {
                throw new Error(`Shield handle component "${handle}" couldn't be found!`);
            } else {
                return getItem({components, quality, equip_slot: "off-hand", item_type: "EQUIPPABLE"});
            }
        } else if(internal) { //armor
            if(!item_templates[internal]){
                throw new Error(`Internal armor component "${internal}" couldn't be found!`);
            } else if(!item_templates[external]) {
                throw new Error(`External armor component "${external}" couldn't be found!`);
            } else {
                let equip_slot = getArmorSlot(internal);
                if(!equip_slot) {
                    return;
                }
                return getItem({components, quality, equip_slot, item_type: "EQUIPPABLE"});
            }
        } else {
            throw new Error(`Intentory key "${key}" seems to refer to non-existing item type!`);
        }
    } else if(quality) { //no comps but quality (clothing / artifact?)
        return getItem({...item_templates[id], quality});
    } else {
        throw new Error(`Intentory key "${key}" is incorrect!`);
    }
}

//book stats
book_stats["ABC for kids"] = new BookData({
    required_time: 120,
    literacy_xp_rate: 1,
    rewards: {
        xp_multipliers: {
            all: 1.1,
        },
    },
	repeat_rewards: {
    xp: {
        Literacy: 100,
    }
},
});


book_stats["Muscle Wizard Adventures"] = new BookData({
    required_time: 120,
    literacy_xp_rate: 1,
    rewards: {
        xp_multipliers: {
            Unarmed: 1.1,
        },
		unlock_magic: "Strengthen",
    },
	repeat_rewards: {
    xp: {
        Unarmed: 100,
    }
},
});

book_stats["Basic Barrier Magic"] = new BookData({
    required_time: 120,
    literacy_xp_rate: 1,
    rewards: {
        xp_multipliers: {
            "Barrier Magic": 1.1,
        },
		unlock_magic: "Shield",
    },
	repeat_rewards: {
    xp: {
        "Barrier Magic": 100,
    }
},
});

book_stats["Peak Literature"] = new BookData({
    required_time: 120,
    literacy_xp_rate: 1,
    rewards: {
        xp_multipliers: {
            Literacy: 1.05,
        }
    },
	repeat_rewards: {
    xp: {
        Literacy: 100,
    }
},
});

book_stats["Old combat manual"] = new BookData({
    required_time: 320,
    literacy_xp_rate: 1,
    rewards: {
        xp_multipliers: {
            Combat: 1.2,
        },
		unlock_stance: "protect",
    },
	repeat_rewards: {
    xp: {
        Combat: 1000,
    }
},
});

book_stats["Twist liek a snek"] = new BookData({
    required_time: 320,
    literacy_xp_rate: 1,
    rewards: {
        xp_multipliers: {
            Evasion: 1.2,
        }
    },
	repeat_rewards: {
    xp: {
        Evasion: 1000,
    }
},
});

book_stats["Ye olde dictionary"] = new BookData({
    required_time: 320,
    literacy_xp_rate: 2,
    rewards: {
        xp_multipliers: {
            Literacy: 1.1,
        },
    },
	repeat_rewards: {
    xp: {
        Literacy: 100,
    }
},
});

book_stats["Joy of Mining"] = new BookData({
    required_time: 120,
    literacy_xp_rate: 1,
    rewards: {
        xp_multipliers: {
            Mining: 1.1,
        }
    },
	repeat_rewards: {
    xp: {
        Mining: 1000,
    }
},
});

book_stats["Joy of Fishing"] = new BookData({
    required_time: 120,
    literacy_xp_rate: 1,
    rewards: {
        xp_multipliers: {
            Fishing: 1.1,
        }
    },
	repeat_rewards: {
    xp: {
        Fishing: 1000,
    }
},
});

book_stats["Joy of Woodcutting"] = new BookData({
    required_time: 120,
    literacy_xp_rate: 1,
    rewards: {
        xp_multipliers: {
            Woodcutting: 1.1,
        }
    },
	repeat_rewards: {
    xp: {
        Woodcutting: 1000,
    }
},
});

book_stats["Joy of Herbalism"] = new BookData({
    required_time: 120,
    literacy_xp_rate: 1,
    rewards: {
        xp_multipliers: {
            Herbalism: 1.1,
        }
    },
	repeat_rewards: {
    xp: {
        Herbalism: 1000,
    }
},
});

book_stats["Power of Dreams"] = new BookData({
    required_time: 60,
    literacy_xp_rate: 1,
    rewards: {
        xp_multipliers: {
            Sleeping: 1.1,
        }
    },
	repeat_rewards: {
    xp: {
        Sleeping: 500,
    }
},
});

book_stats["TRUE ULTIMATE POWER"] = new BookData({
    required_time: 100,
    literacy_xp_rate: 1,
	rewards: {
        xp_multipliers: {
            "Mana Expansion": 1.1,
        },
		unlock_magic: "Empower",
    },
	repeat_rewards: {
    xp: {
        "Mana Expansion": 1000,
    }
	},
	unlocks: {unlock_magic: "Empower"},
});

book_stats["The Spellblade Chronicles vol. 1"] = new BookData({
    required_time: 100,
    literacy_xp_rate: 1,
	rewards: {
        xp_multipliers: {
            "Spellblade Stance Mastery": 1.1,
        },
		unlock_stance: "spellblade"
    },
	repeat_rewards: {
    xp: {
        "Spellblade Stance Mastery": 1000,
    }
},
	unlocks: {unlock_stance: "spellblade"},
});

book_stats["Practical Applications of Time Travel"] = new BookData({
    required_time: 100,
    literacy_xp_rate: 1,
	rewards: {
        xp_multipliers: {
            "Chronomancy": 1.1,
        },
		unlock_magic: "Haste"
    },
	repeat_rewards: {
    xp: {
        "Chronomancy": 1000,
    }
},
	
});


//books
item_templates["ABC for kids"] = new Book({
    name: "ABC for kids",
    description: "The simplest book on the market",
    value: 500,
});

item_templates["Peak Literature"] = new Book({
    name: "Peak Literature",
    description: "Reborn as the Second Bastard Son of the 8th Margrave with an Animal Husbandry skill, so I'll Live As I Please Whilst Cheating at Horse Racing",
    value: 500,
});

item_templates["Old combat manual"] = new Book({
    name: "Old combat manual",
    description: "Old book about combat, worn and outdated, but might still contain something useful",
    value: 1000,
});

item_templates["Twist liek a snek"] = new Book({
    name: "Twist liek a snek",
    description: "This book has a terrible grammar, seemingly written by some uneducated bandit, but despite that it quite well details how to properly evade attacks.",
    value: 1000,
});

item_templates["Ye olde dictionary"] = new Book({
    name: "Ye olde dictionary",
    description: "Ye olde dictionary",
    value: 1000,
});


item_templates["Joy of Mining"] = new Book({
    name: "Joy of Mining",
    description: "Joy of Mining",
    value: 1000,
});

item_templates["Joy of Woodcutting"] = new Book({
    name: "Joy of Woodcutting",
    description: "Joy of Woodcutting",
    value: 1000,
});

item_templates["Joy of Fishing"] = new Book({
    name: "Joy of Fishing",
    description: "Joy of Fishing",
    value: 1000,
});

item_templates["Joy of Herbalism"] = new Book({
    name: "Joy of Herbalism",
    description: "Joy of Herbalism",
    value: 1000,
});

item_templates["Power of Dreams"] = new Book({
    name: "Power of Dreams",
    description: "Power of Dreams",
    value: 1000,
});

item_templates["TRUE ULTIMATE POWER"] = new Book({
    name: "TRUE ULTIMATE POWER",
    description: "TRUE ULTIMATE POWER",
    value: 2000,
});
item_templates["Muscle Wizard Adventures"] = new Book({
    name: "Muscle Wizard Adventures",
    description: "Muscle Wizard Adventures",
    value: 2000,
});
item_templates["Basic Barrier Magic"] = new Book({
    name: "Basic Barrier Magic",
    description: "Basic Barrier Magic",
    value: 2000,
});
item_templates["Practical Applications of Time Travel"] = new Book({
    name: "Practical Applications of Time Travel",
    description: "Practical Applications of Time Travel",
    value: 2000,
});

item_templates["The Spellblade Chronicles vol. 1"] = new Book({
    name: "The Spellblade Chronicles vol. 1",
    description: "The Spellblade Chronicles vol. 1",
    value: 2000,
});

//miscellaneous and loot:
(function(){
 

    item_templates["Wolf fang"] = new OtherItem({
        name: "Wolf fang", 
        description: "Fang of a wild wolf. Somewhat sharp, still not very useful. Maybe if it had a bit better quality...", 
        value: 12,
        saturates_market: true,
        price_recovers: true,
    });

    item_templates["Rat meat chunks"] = new OtherItem({
        name: "Rat meat chunks", 
        description: "Eww", 
        value: 8,
        saturates_market: true,
        price_recovers: true,
    });

    item_templates["Glass phial"] = new OtherItem({
        name: "Glass phial", 
        description: "Small glass phial, a perfect container for a potion", 
        value: 10,
        saturates_market: false,
    });
	    item_templates["Research paper"] = new OtherItem({
        name: "Research paper", 
        description: "The scribbled writings of a madman, but perhaps they hold value....", 
        value: 10,
        saturates_market: false,
    });
	
	
})();

//lootable materials
(function(){
    item_templates["Rat tail"] = new Material({
        name: "Rat tail", 
        description: "Tail of a huge rat. Doesn't seem very useful, but maybe some meat could be recovered from it", 
        value: 4,
        price_recovers: true,
        material_type: "meat source",
    });
    item_templates["Rat pelt"] = new Material({
        name: "Rat pelt", 
        description: "Pelt of a huge rat. Fur has terrible quality, but maybe leather could be used for something if you gather more?", 
        value: 10,
        price_recovers: true,
        material_type: "pelt",
    });
    item_templates["High quality wolf fang"] = new Material({
        name: "High quality wolf fang", 
        description: "Fang of a wild wolf. Very sharp, undamaged and surprisingly clean.", 
        value: 15,
        price_recovers: true,
        material_type: "miscellaneous",
    });
    item_templates["Wolf pelt"] = new Material({
        name: "Wolf pelt", 
        description: "Pelt of a wild wolf. It's a bit damaged so it won't fetch a great price, but the leather itself could be useful.", 
        value: 20,
        price_recovers: true,
        material_type: "pelt",
    });

    item_templates["Boar hide"] = new Material({
        name: "Boar hide", 
        description: "Thick hide of a wild boar. Too stiff for clothing, but might be useful for an armor",
        value: 30,
        price_recovers: true,
        material_type: "pelt",
    });
    item_templates["Boar meat"] = new Material({
        name: "Boar meat",
        description: "Fatty meat of a wild boar, all it needs is to be cooked.",
        value: 20,
        price_recovers: true,
        material_type: "meat source",
    });
    item_templates["High quality boar tusk"] = new Material({
        name: "High quality boar tusk", 
        description: "Tusk of a wild boar. Sharp and long enough to easily kill an adult human", 
        value: 25,
        price_recovers: true,
        material_type: "miscellaneous",
    });

    item_templates["Weak monster bone"] = new Material({
        name: "Weak monster bone", 
        description: "Mutated and dark bone of a monster. While far on the weaker side, it's still very strong",
        value: 30,
        price_recovers: true,
        material_type: "bone",
    });

    item_templates["Bones"] = new Material({
        name: "Bones", 
        description: "Skeleton bone",
        value: 5,
        price_recovers: true,
        material_type: "bone",
    });
	    item_templates["Elite skull"] = new Material({
        name: "Elite skull", 
        description: "The cranium of an above-average undead.",
        value: 20,
        price_recovers: true,
        material_type: "bone",
    });
	

	    item_templates["Slime Jelly"] = new Material({
        name: "Slime Jelly", 
        description: "Slime Jelly",
        value: 1,
        price_recovers: true,
        material_type: "material",
    });

	    item_templates["Platinum Shard"] = new Material({
        name: "Platinum Shard", 
        description: "Platinum Shard",
        value: 1000,
        price_recovers: true,
    });    

	
	    item_templates["Magic Stone"] = new Material({
        name: "Magic Stone", 
        description: "Magic Stone",
        value: 30,
        price_recovers: true,
        material_type: "material",
    });

	    item_templates["Chimera Spine"] = new Material({
        name: "Chimera Spine", 
        description: "Chimera Spine",
        value: 50,
        price_recovers: true,
        material_type: "material",
    });
	

	
		item_templates["Regenerating Flesh"] = new Material({
        name: "Regenerating Flesh", 
        description: "Regenerating Flesh",
        value: 100,
        price_recovers: true,
        material_type: "material",
    });
	
		item_templates["Dragon Bone"] = new Material({
        name: "Dragon Bone", 
        description: "Dragon Bone",
        value: 100,
        price_recovers: true,
        material_type: "material",
    });

item_templates["Spider Silk"] = new Material({
    name: "Spider Silk", 
    description: "Strong and lightweight silk produced by spiders.",
    value: 12,
    price_recovers: true,
    material_type: "material",
});

item_templates["Spider Fang"] = new Material({
    name: "Spider Fang", 
    description: "A venomous fang harvested from a spider.",
    value: 8,
    price_recovers: true,
    material_type: "material",
});



item_templates["Venom Gland"] = new Material({
    name: "Venom Gland", 
    description: "A gland filled with potent spider venom.",
    value: 18,
    price_recovers: true,
    material_type: "material",
});

item_templates["Chitin Plate"] = new Material({
    name: "Chitin Plate", 
    description: "A thick segment of hardened chitin armor.",
    value: 16,
    price_recovers: true,
    material_type: "material",
});

item_templates["Spider Core"] = new Material({
    name: "Spider Core", 
    description: "A rare magical core found in elite spider types.",
    value: 30,
    price_recovers: true,
    material_type: "material",
});

item_templates["Royal Silk"] = new Material({
    name: "Royal Silk", 
    description: "Exceptionally strong silk only found on the Spider Queen.",
    value: 40,
    price_recovers: true,
    material_type: "material",
});


item_templates["Ant Core"] = new Material({
    name: "Ant Core", 
    description: "A glowing organic core found in elite ants.",
    value: 24,
    price_recovers: true,
    material_type: "material",
});

item_templates["Royal Jelly"] = new Material({
    name: "Royal Jelly", 
    description: "Nutrient-rich jelly harvested from an ant queen’s nest.",
    value: 32,
    price_recovers: true,
    material_type: "material",
});

//junk items 
item_templates["Ant Mandible"] = new Junk({
    name: "Ant Mandible", 
    description: "A sturdy biting appendage from a soldier or worker ant.",
    value: 6,
    price_recovers: true,
});
item_templates["Chitin Shard"] = new Junk({
    name: "Chitin Shard", 
    description: "A brittle fragment of a spider’s exoskeleton.",
    value: 10,
    price_recovers: true,
});
	    item_templates["Bat Wings"] = new Junk({
        name: "Bat Wings", 
        description: "Bat Wings",
        value: 2,
        price_recovers: true,
    });
	    item_templates["Goo"] = new Junk({
        name: "Goo", 
        description: "Goo",
        value: 1,
        price_recovers: true,
    });
	    item_templates["Acid"] = new Junk({
        name: "Acid", 
        description: "Acid",
        value: 10,
        price_recovers: true,
    });

	    item_templates["Burning Goo"] = new Junk({
        name: "Burning Goo", 
        description: "Burning Goo",
        value: 10,
        price_recovers: true,
    });
    item_templates["Ectoplasm"] = new Junk({
        name: "Ectoplasm", 
        description: "Ectoplasm",
        value: 8,
        price_recovers: true,
    });
	
    item_templates["Congealed Blood"] = new Junk({
        name: "Congealed Blood", 
        description: "Congealed Blood",
        value: 10,
        price_recovers: true,
    });

    item_templates["Rotten Flesh"] = new Junk({
        name: "Rotten Flesh", 
        description: "A rotting lump of flesh. Why would you even pick it up?",
        value: 1,
        price_recovers: true,
    });
   item_templates["Rat fang"] = new Junk({
        name: "Rat fang", 
        description: "Fang of a huge rat, not very sharp, but can still pierce a human skin if enough force is applied", 
        value: 8,
        saturates_market: true,
        price_recovers: true,
    });	

	
//key items

    item_templates["Castle Key"] = new KeyItem({
        name: "Castle Key", 
        description: "Key to the castle.",
        value: 1,
        price_recovers: true,
    });
    item_templates["Purest Darkness"] = new KeyItem({
        name: "Purest Darkness", 
        description: "Purest Darkness",
        value: 1, 
    });


})();

//gatherable materials
(function(){
    item_templates["Low quality iron ore"] = new Material({
        name: "Low quality iron ore", 
        description: "Iron content is rather low and there are a lot of problematic components that can't be fully removed, which will affect created materials.", 
        value: 3,
        saturates_market: true,
        price_recovers: true,
        material_type: "raw metal",
    });
    item_templates["Iron ore"] = new Material({
        name: "Iron ore", 
        description: "It has a decent iron content and can be smelt into market-quality iron.", 
        value: 5,
        saturates_market: true,
        price_recovers: true,
        material_type: "raw metal",
    });
    item_templates["Blacksteel ore"] = new Material({
        name: "Blacksteel ore", 
        description: "Blacksteel ore", 
        value: 10,
        saturates_market: true,
        price_recovers: true,
        material_type: "raw metal",
    });
    item_templates["Mithril ore"] = new Material({
        name: "Mithril ore", 
        description: "Mithril ore", 
        value: 20,
        saturates_market: true,
        price_recovers: true,
        material_type: "raw metal",
    });
	
	
    item_templates["Piece of rough wood"] = new Material({
        name: "Piece of rough wood", 
        description: "Cheapest form of wood. There's a lot of bark and malformed pieces.", 
        value: 2,
        saturates_market: true,
        price_recovers: true,
        material_type: "raw wood",
    });
    item_templates["Piece of wood"] = new Material({
        name: "Piece of wood", 
        description: "Average quality wood. There's a lot of bark and malformed pieces.", 
        value: 4,
        saturates_market: true,
        price_recovers: true,
        material_type: "raw wood",
    });
    item_templates["Piece of ash wood"] = new Material({
        name: "Piece of ash wood", 
        description: "Strong yet elastic, it's among the best wood you can hope to find around. There's a lot of bark and malformed pieces.",
        value: 7,
        saturates_market: true,
        price_recovers: true,
        material_type: "raw wood",
    });
    item_templates["Piece of mahogany wood"] = new Material({
        name: "Piece of mahogany wood", 
        description: "Firm strong wood, it's the best wood you can hope to find around. There's a lot of bark and malformed pieces.",
        value: 12,
        saturates_market: true,
        price_recovers: true,
        material_type: "raw wood",
    });	

    item_templates["Belmart leaf"] = new Material({
        name: "Belmart leaf", 
        description: "Small, round, dark-green leaves with with very good disinfectant properties",
        value: 8,
        saturates_market: true,
        price_recovers: true,
        material_type: "disinfectant herb",
    });

    item_templates["Golmoon leaf"] = new Material({
        name: "Golmoon leaf", 
        description: "Big green-brown leaves that can be applied to wounds to speed up their healing",
        value: 8,
        saturates_market: true,
        price_recovers: true,
        material_type: "healing herb",
    });

    item_templates["Oneberry"] = new Material({
        name: "Oneberry", 
        description: "Small blue berries capable of stimulating body's natural healing",
        value: 8,
        saturates_market: true,
        price_recovers: true,
        material_type: "healing herb",
    });

item_templates["Cinderpetal"] = new Material({
    name: "Cinderpetal",
    description: "Bright red-orange petals that radiate faint warmth and can be used in burn salves and stimulants.",
    value: 10,
    saturates_market: true,
    price_recovers: true,
    material_type: "fire herb",
});

item_templates["Ashroot"] = new Material({
    name: "Ashroot",
    description: "A blackened root found near volcanic soil, known to boost resistance against extreme heat.",
    value: 22,
    saturates_market: true,
    price_recovers: true,
    material_type: "fire herb",
});

item_templates["Flamevine"] = new Material({
    name: "Flamevine",
    description: "A creeping vine with ember-colored leaves that ignite slightly when crushed. Used in alchemical accelerants.",
    value: 45,
    saturates_market: true,
    price_recovers: true,
    material_type: "fire herb",
});

item_templates["Frostleaf"] = new Material({
    name: "Frostleaf",
    description: "Pale blue leaves that feel icy to the touch, often used to reduce swelling and cool fevers.",
    value: 10,
    saturates_market: true,
    price_recovers: true,
    material_type: "ice herb",
});

item_templates["Winterbloom"] = new Material({
    name: "Winterbloom",
    description: "A rare flower that blooms during snowfall, said to contain concentrated cold energy used in potions.",
    value: 22,
    saturates_market: true,
    price_recovers: true,
    material_type: "ice herb",
});

item_templates["Cryoroot"] = new Material({
    name: "Cryoroot",
    description: "A thick root with a frosty sheen, used to make poultices for numbing pain and frost protection.",
    value: 44,
    saturates_market: true,
    price_recovers: true,
    material_type: "ice herb",
});

item_templates["Bloodnettle"] = new Material({
    name: "Bloodnettle",
    description: "A stinging herb that improves blood flow and can rapidly close minor wounds when properly prepared.",
    value: 10,
    saturates_market: true,
    price_recovers: true,
    material_type: "healing herb",
});

item_templates["Starshade"] = new Material({
    name: "Starshade",
    description: "A night-blooming plant used to reduce fevers and calm frantic patients. Rare in most regions.",
    value: 10,
    saturates_market: true,
    price_recovers: true,
    material_type: "cooling herb",
});

item_templates["Veindust"] = new Material({
    name: "Veindust",
    description: "A silvery moss that grows on old ruins, useful for promoting blood clotting and magical focus.",
    value: 25,
    saturates_market: true,
    price_recovers: true,
    material_type: "mystic herb",
});

item_templates["Duskrill"] = new Material({
    name: "Duskrill",
    description: "Soft, dark purple tendrils used in both sedatives and mild poisons depending on preparation.",
    value: 26,
    saturates_market: true,
    price_recovers: true,
    material_type: "versatile herb",
});

item_templates["Sunberry"] = new Material({
    name: "Sunberry",
    description: "Golden berries with energizing properties, often added to stimulants and warming tonics.",
    value: 42,
    saturates_market: true,
    price_recovers: true,
    material_type: "energizing herb",
});

item_templates["Glowcap"] = new Material({
    name: "Glowcap",
    description: "A bioluminescent fungus used to sterilize wounds and light alchemical mixtures.",
    value: 47,
    saturates_market: true,
    price_recovers: true,
    material_type: "disinfectant herb",
});


    item_templates["Wool"] = new Material({
        name: "Wool", 
        description: "A handful of wool, raw and unprocessed",
        value: 8,
        saturates_market: true,
        price_recovers: true,
        material_type: "raw fabric",
    });
	
    item_templates["Rotten Bonefish"] = new Material({
        name: "Rotten Bonefish", 
        description: "Rotten Bonefish",
        value: 8,
        saturates_market: true,
        price_recovers: true,
        material_type: "fish",
    });
    item_templates["Perfect Plaice"] = new Material({
        name: "Perfect Plaice", 
        description: "Perfect Plaice",
        value: 8,
        saturates_market: true,
        price_recovers: true,
        material_type: "fish",
    });
    item_templates["Curious Catfish"] = new Material({
        name: "Curious Catfish", 
        description: "Curious Catfish",
        value: 8,
        saturates_market: true,
        price_recovers: true,
        material_type: "fish",
    });
    item_templates["Boisterous Bass"] = new Material({
        name: "Boisterous Bass", 
        description: "Boisterous Bass",
        value: 8,
        saturates_market: true,
        price_recovers: true,
        material_type: "fish",
    });
    item_templates["Salty Sardine"] = new Material({
        name: "Salty Sardine", 
        description: "Salty Sardine",
        value: 8,
        saturates_market: true,
        price_recovers: true,
        material_type: "fish",
    });	
    item_templates["Haughty Haddock"] = new Material({
        name: "Haughty Haddock", 
        description: "Haughty Haddock",
        value: 8,
        saturates_market: true,
        price_recovers: true,
        material_type: "fish",
    });	
    item_templates["Glimmering Goldfish"] = new Material({
        name: "Glimmering Goldfish", 
        description: "Glimmering Goldfish",
        value: 8,
        saturates_market: true,
        price_recovers: true,
        material_type: "fish",
    });	
    item_templates["Cunning Carp"] = new Material({
        name: "Cunning Carp", 
        description: "Cunning Carp",
        value: 8,
        saturates_market: true,
        price_recovers: true,
        material_type: "fish",
    });	
    item_templates["Timid Tuna"] = new Material({
        name: "Timid Tuna", 
        description: "Timid Tuna",
        value: 8,
        saturates_market: true,
        price_recovers: true,
        material_type: "fish",
    });	
    item_templates["Meagre Minnow"] = new Material({
        name: "Meagre Minnow", 
        description: "Meagre Minnow",
        value: 8,
        saturates_market: true,
        price_recovers: true,
        material_type: "fish",
    });
    item_templates["Rowdy Rainbowfish"] = new Material({
        name: "Rowdy Rainbowfish", 
        description: "Rowdy Rainbowfish",
        value: 8,
        saturates_market: true,
        price_recovers: true,
        material_type: "fish",
    });
    item_templates["Clingy Crab"] = new Material({
        name: "Clingy Crab", 
        description: "Clingy Crab",
        value: 8,
        saturates_market: true,
        price_recovers: true,
        material_type: "fish",
    });	
})();

(function(){
	    item_templates["Diamond"] = new OtherItem({
        name: "Diamond", 
        description: "A rare shining jewel found whilst mining.", 
        value: 1000,
        saturates_market: false,
    });
	    item_templates["Golden Apple"] = new OtherItem({
        name: "Golden Apple", 
        description: "A rare prize found whilst woodcutting.", 
        value: 1000,
        saturates_market: false,
    });	
		    item_templates["Succulent Shark"] = new OtherItem({
        name: "Succulent Shark", 
        description: "A rare prize found whilst fishing.", 
        value: 1000,
        saturates_market: false,
    });
		    item_templates["Miracle Weed"] = new OtherItem({
        name: "Miracle Weed", 
        description: "A rare prize found whilst gathering herbs.", 
        value: 1000,
        saturates_market: false,
    });

})();




//processed materials
(function(){
    item_templates["Low quality iron ingot"] = new Material({
        id: "Low quality iron ingot",
        name: "Low quality iron ingot", 
        description: "It has a lot of impurities, resulting in it being noticeably below the market standard", 
        value: 10,
        saturates_market: true,
        price_recovers: true,
        material_type: "metal",
    });
    item_templates["Iron ingot"] = new Material({
        id: "Iron ingot",
        name: "Iron ingot", 
        description: "It doesn't suffer from any excessive impurities and can be used without worries.", 
        value: 20,
        saturates_market: true,
        price_recovers: true,
        material_type: "metal",
    });
    item_templates["Blacksteel ingot"] = new Material({
        id: "Blacksteel ingot",
        name: "Blacksteel ingot", 
        description: "It doesn't suffer from any excessive impurities and can be used without worries.", 
        value: 30,
        saturates_market: true,
        price_recovers: true,
        material_type: "metal",
    });
    item_templates["Mithril ingot"] = new Material({
        id: "Mithril ingot",
        name: "Mithril ingot", 
        description: "It doesn't suffer from any excessive impurities and can be used without worries.", 
        value: 40,
        saturates_market: true,
        price_recovers: true,
        material_type: "metal",
    });
    item_templates["Piece of wolf rat leather"] = new Material({
        name: "Piece of wolf rat leather",
        description: "It's slightly damaged and seems useless for anything that requires precise work.",
        value: 10,
        saturates_market: true,
        price_recovers: true,
        material_type: "piece of leather",
    });
    item_templates["Piece of wolf leather"] = new Material({
        name: "Piece of wolf leather", 
        description: "Somewhat strong, should offer some protection when turned into armor",
        value: 20,
        saturates_market: true,
        price_recovers: true,
        material_type: "piece of leather",
    });
    item_templates["Piece of boar leather"] = new Material({
        name: "Piece of boar leather", 
        description: "Thick and resistant leather, too stiff for clothes but perfect for armor",
        value: 30,
        saturates_market: true,
        price_recovers: true,
        material_type: "piece of leather",
    });
    item_templates["Wool cloth"] = new Material({
        name: "Wool cloth", 
        description: "Thick and warm, might possibly absord some punches",
        value: 8,
        saturates_market: true,
        price_recovers: true,
        material_type: "fabric",
    });
    item_templates["Iron chainmail"] = new Material({
        name: "Iron chainmail", 
        description: "Dozens of tiny iron rings linked together. Nowhere near a wearable form, turning it into armor will still take a lot of effort and focus",
        value: 12,
        saturates_market: true,
        price_recovers: true,
        material_type: "chainmail",
    });
    item_templates["Scraps of wolf rat meat"] = new Material({
        name: "Scraps of wolf rat meat", 
        description: "Ignoring where they come from and all the attached diseases, they actually look edible. Just remember to cook it first.",
        value: 8,
        saturates_market: true,
        price_recovers: true,
        material_type: "meat",
    });
    item_templates["Processed rough wood"] = new Material({
        name: "Processed rough wood", 
        description: "Cheapest form of wood, ready to be used. Despite being rather weak, it still has a lot of uses.",
        value: 6,
        saturates_market: true,
        price_recovers: true,
        material_type: "wood",
    });

    item_templates["Processed wood"] = new Material({
        name: "Processed wood", 
        description: "Average quality wood, ready to be used.",
        value: 11,
        saturates_market: true,
        price_recovers: true,
        material_type: "wood",
    });

    item_templates["Processed ash wood"] = new Material({
        name: "Processed ash wood", 
        description: "High quality wood, just waiting to be turned into a piece of equipment.",
        value: 20,
        saturates_market: true,
        price_recovers: true,
        material_type: "wood",
    });
    item_templates["Processed mahogany wood"] = new Material({
        name: "Processed mahogany wood", 
        description: "High quality wood, just waiting to be turned into a piece of equipment.",
        value: 30,
        saturates_market: true,
        price_recovers: true,
        material_type: "wood",
    });

})();

//spare parts
(function(){
    item_templates["Basic spare parts"] = new OtherItem({
        name: "Basic spare parts", 
        description: "Some cheap and simple spare parts, like bindings and screws, necessary for crafting equipment",
        value: 30, 
        component_tier: 1,
    });
}());

(function(){
    item_templates["Order Badge"] = new OtherItem({
        name: "Order Badge", 
        description: "A knightly proof.",
        value: 200, 
    });
}());

(function(){
    item_templates["Demonic Essence"] = new OtherItem({
        name: "Demonic Essence", 
        description: "A bauble that brims with infernal power",
        value: 2000, 
    });
}());

(function(){
    item_templates["Imperial Regalia"] = new OtherItem({
        name: "Imperial Regalia", 
        description: "Imperial Regalia",
        value: 5000, 
    });

}());


//weapon components:
(function(){
    item_templates["Cheap short iron blade"] = new WeaponComponent({
        name: "Cheap short iron blade", description: "Crude blade made of iron. Perfect length for a dagger, but could be also used for a spear",
        component_type: "short blade",
        value: 70,
        component_tier: 1,
        name_prefix: "Cheap iron",
        attack_value: 5,
        component_stats: {
            crit_rate: {
                flat: 0.06,
            },
            attack_speed: {
                multiplier: 1.20,
            },
            agility: {
                multiplier: 1.05,
            }
        }
    });
    item_templates["Short iron blade"] = new WeaponComponent({
        name: "Short iron blade", description: "A good iron blade. Perfect length for a dagger, but could be also used for a spear",
        component_type: "short blade",
        value: 160,
        component_tier: 2,
        name_prefix: "Iron",
        attack_value: 8,
        component_stats: {
            crit_rate: {
                flat: 0.08,
            },
            attack_speed: {
                multiplier: 1.30,
            },
            agility: {
                multiplier: 1.13,
            }
        }
    });
    item_templates["Short blacksteel blade"] = new WeaponComponent({
        name: "Short blacksteel blade", description: "A good blacksteel blade. Perfect length for a dagger, but could be also used for a spear",
        component_type: "short blade",
        value: 240,
        component_tier: 3,
        name_prefix: "Blacksteel",
        attack_value: 11,
        component_stats: {
            crit_rate: {
                flat: 0.1,
            },
            attack_speed: {
                multiplier: 1.35,
            },
            agility: {
                multiplier: 1.2,
            },
			         attack_points: {
                multiplier: 1.25,
            }
        }
    });
    item_templates["Short mithril blade"] = new WeaponComponent({
        name: "Short mithril blade", description: "A good mithril blade. Perfect length for a dagger, but could be also used for a spear",
        component_type: "short blade",
        value: 360,
        component_tier: 4,
        name_prefix: "Mithril",
        attack_value: 14,
        component_stats: {
            crit_rate: {
                flat: 0.12,
            },
            attack_speed: {
                multiplier: 1.40,
            },
            agility: {
                multiplier: 1.28,
            },
				        attack_points: {
                multiplier: 1.5,
            },
        }
    });
	
    item_templates["Cheap long iron blade"] = new WeaponComponent({
        name: "Cheap long iron blade", description: "Crude blade made of iron, with a perfect length for a sword",
        component_type: "long blade",
        value: 100,
        name_prefix: "Cheap iron",
        component_tier: 1,
        attack_value: 8,
        component_stats: {
            attack_speed: {
                multiplier: 1.10,
            },
            crit_rate: {
                flat: 0.02,
            },
        }
    });
    item_templates["Long iron blade"] = new WeaponComponent({
        name: "Long iron blade", description: "Good blade made of iron, with a perfect length for a sword",
        component_type: "long blade",
        value: 210,
        name_prefix: "Iron",
        component_tier: 2,
        attack_value: 13,
        component_stats: {
            attack_speed: {
                multiplier: 1.15,
            },
            crit_rate: {
                flat: 0.04,
            },
        }
    });
    item_templates["Long blacksteel blade"] = new WeaponComponent({
        name: "Long blacksteel blade", description: "Good blade made of blacksteel, with a perfect length for a sword",
        component_type: "long blade",
        value: 310,
        name_prefix: "Blacksteel",
        component_tier: 3,
        attack_value: 18,
        component_stats: {
            attack_speed: {
                multiplier: 1.2,
            },
            crit_rate: {
                flat: 0.05,
            },
						         attack_points: {
                multiplier: 1.25,
            }
        }
    });
    item_templates["Long mithril blade"] = new WeaponComponent({
        name: "Long mithril blade", description: "Good blade made of mithril, with a perfect length for a sword",
        component_type: "long blade",
        value: 450,
        name_prefix: "Mithril",
        component_tier: 4,
        attack_value: 23,
        component_stats: {
            attack_speed: {
                multiplier: 1.25,
            },
            crit_rate: {
                flat: 0.06,
            },
				        attack_points: {
                multiplier: 1.5,
            },
        }
    });	
    item_templates["Cheap iron axe head"] = new WeaponComponent({
        name: "Cheap iron axe head", description: "A heavy axe head made of low quality iron",
        component_type: "axe head",
        value: 100,
        name_prefix: "Cheap iron",
        component_tier: 1,
        attack_value: 10,
        component_stats: {
            attack_speed: {
                multiplier: 0.9,
            }
        }
    });
    item_templates["Iron axe head"] = new WeaponComponent({
        name: "Iron axe head", description: "A heavy axe head made of blacksteel",
        component_type: "axe head",
        value: 210,
        name_prefix: "Iron",
        component_tier: 2,
        attack_value: 16,
        component_stats: {
            attack_speed: {
                multiplier: 0.95,
            },
			
        }
    });
    item_templates["Blacksteel axe head"] = new WeaponComponent({
        name: "Blacksteel axe head", description: "A heavy axe head made of blacksteel",
        component_type: "axe head",
        value: 310,
        name_prefix: "Blacksteel",
        component_tier: 3,
        attack_value: 22,
			    component_stats: {
        attack_points: {
                multiplier: 1.25,
            }
        }
		
    });
	

   item_templates["Mithril axe head"] = new WeaponComponent({
        name: "Mithril axe head", description: "A heavy axe head made of mithril",
        component_type: "axe head",
        value: 450,
        name_prefix: "Mithril",
        component_tier: 4,
        attack_value: 28,
		    component_stats: {
            attack_speed: {
                multiplier: 1.05,
            },
				        attack_points: {
                multiplier: 1.5,
            },
        }
    });	
	
    item_templates["Cheap iron hammer head"] = new WeaponComponent({
        name: "Cheap iron hammer head", description: "A crude ball made of low quality iron, with a small hole for the handle",
        component_type: "hammer head",
        value: 100,
        name_prefix: "Cheap iron",
        component_tier: 1,
        attack_value: 12,
        component_stats: {
            attack_speed: {
                multiplier: 0.8,
            }
        }
    });

    item_templates["Iron hammer head"] = new WeaponComponent({
        name: "Iron hammer head", description: "A crude ball made of iron, with a small hole for the handle",
        component_type: "hammer head",
        value: 210,
        name_prefix: "Iron",
        component_tier: 2,
        attack_value: 19,
        component_stats: {
            attack_speed: {
                multiplier: 0.85,
            }
        }
    });
    item_templates["Blacksteel hammer head"] = new WeaponComponent({
        name: "Blacksteel hammer head", description: "A blocky piece of blacksteel, with a small hole for the handle",
        component_type: "hammer head",
        value: 300,
        name_prefix: "Blacksteel",
        component_tier: 3,
        attack_value: 26,
        component_stats: {
            attack_speed: {
                multiplier: 0.9,
            },
			 attack_points: {
                multiplier: 1.25,
            }
        }
    });
    item_templates["Mithril hammer head"] = new WeaponComponent({
        name: "Mithril hammer head", description: "A blocky piece of mithril, with a small hole for the handle",
        component_type: "hammer head",
        value: 450,
        name_prefix: "Mithril",
        component_tier: 4,
        attack_value: 33,
        component_stats: {
            attack_speed: {
                multiplier: 0.95,
            },
				        attack_points: {
                multiplier: 1.5,
            },
        }
    });
	
    item_templates["Short platinum blade"] = new WeaponComponent({
        name: "Short platinum blade", description: "A good platinum blade. Perfect length for a dagger, but could be also used for a spear",
        component_type: "short blade",
        value: 240,
        component_tier: 3,
        name_prefix: "Platinum",
		name_override: {
			dagger: "Ducat Dirk",
			spear: "Gilded Glaive"
		},
        attack_value: 11,
        component_stats: {
            crit_rate: {
                flat: 0.1,
            },
            attack_speed: {
                multiplier: 1.35,
            },
            agility: {
                multiplier: 1.2,
            },
			         attack_points: {
                multiplier: 1.25,
            }
        }
    });
	
	
	
    item_templates["Long platinum blade"] = new WeaponComponent({
        name: "Long platinum blade", description: "Good blade made of platinum, with a perfect length for a sword",
        component_type: "long blade",
        value: 310,
        name_prefix: "Platinum",
		name_override: "Coin Cutlass",
        component_tier: 3,
        attack_value: 18,
        component_stats: {
            attack_speed: {
                multiplier: 1.2,
            },
            crit_rate: {
                flat: 0.05,
            },
						         attack_points: {
                multiplier: 1.25,
            }
        }
    });
	    item_templates["Platinum axe head"] = new WeaponComponent({
        name: "Platinum axe head", description: "A heavy axe head made of platinum",
        component_type: "axe head",
        value: 310,
        name_prefix: "Platinum",
		name_override: "Banker’s Battleaxe",
        component_tier: 3,
        attack_value: 22,
			    component_stats: {
        attack_points: {
                multiplier: 1.25,
            }
        }
		
    });
    item_templates["Platinum hammer head"] = new WeaponComponent({
        name: "Platinum hammer head", description: "A blocky piece of platinum, with a small hole for the handle",
        component_type: "hammer head",
        value: 300,
        name_prefix: "Platinum",
		name_override: "Money Mallet",
        component_tier: 3,
        attack_value: 26,
        component_stats: {
            attack_speed: {
                multiplier: 0.9,
            },
			 attack_points: {
                multiplier: 1.25,
            }
        }
    });

    item_templates["Simple short wooden hilt"] = new WeaponComponent({
        name: "Simple short wooden hilt", description: "A short handle for a sword or maybe a dagger",
        component_type: "short handle",
        value: 8,
        component_tier: 1,
		        component_stats: {
            attack_speed: {
                multiplier: 1.0,
            }
        }
    });

    item_templates["Short wooden hilt"] = new WeaponComponent({
        name: "Short wooden hilt", description: "A short handle for a sword or maybe a dagger",
        component_type: "short handle",
        value: 32,
        component_tier: 2,
        component_stats: {
            attack_speed: {
                multiplier: 1.05,
            }
        }
    });

    item_templates["Short ash wood hilt"] = new WeaponComponent({
        name: "Short ash wood hilt", description: "A short handle for a sword or maybe a dagger",
        component_type: "short handle",
        value: 48,
        component_tier: 3,
        component_stats: {
            attack_speed: {
                multiplier: 1.1,
            },
			 attack_points: {
                multiplier: 1.25,
            }
        }
    });
    item_templates["Short mahogany wood hilt"] = new WeaponComponent({
        name: "Short mahogany wood hilt", 
		description: "A short handle for a sword or maybe a dagger",
        component_type: "short handle",
        value: 72,
        component_tier: 4,
        component_stats: {
            attack_speed: {
                multiplier: 1.15,
            },
				        attack_points: {
                multiplier: 1.5,
            },
			
        }
    });	
	

    item_templates["Simple medium wooden handle"] = new WeaponComponent({
        name: "Simple medium wooden handle", description: "A medium handle for an axe or a hammer",
        component_type: "medium handle",
        value: 16,
        component_tier: 1,
        component_stats: {
            attack_speed: {
                multiplier: 0.95,
            }
        }
    });

    item_templates["Medium wooden handle"] = new WeaponComponent({
        name: "Medium wooden handle", description: "A medium handle for an axe or a hammer",
        component_type: "medium handle",
        value: 64,
        component_tier: 2,
    });

    item_templates["Medium ash wood handle"] = new WeaponComponent({
        name: "Medium ash wood handle", description: "A medium handle for an axe or a hammer",
        component_type: "medium handle",
        value: 96,
        component_tier: 3,
        component_stats: {
            attack_speed: {
                multiplier: 1.05,
            },
			 attack_points: {
                multiplier: 1.25,
            }
			
        }
    });
    item_templates["Medium mahogany wood handle"] = new WeaponComponent({
        name: "Medium mahogany wood handle", description: "A medium handle for an axe or a hammer",
        component_type: "medium handle",
        value: 144,
        component_tier: 4,
        component_stats: {
            attack_speed: {
                multiplier: 1.1,
            },
			 attack_points: {
                multiplier: 1.5,
            }
        }
    });	
	

    item_templates["Simple long wooden shaft"] = new WeaponComponent({
        name: "Simple long wooden shaft", description: "A long shaft for a spear, somewhat uneven",
        component_type: "long handle",
        value: 24,
        component_tier: 1,
        component_stats: {
            attack_speed: {
                multiplier: 0.9,
            },
        }
    });

    item_templates["Long wooden shaft"] = new WeaponComponent({
        name: "Long wooden shaft", 
        description: "A long shaft for a spear, somewhat uneven",
        component_type: "long handle",
        value: 100,
        component_tier: 2,
        component_stats: {
            attack_speed: {
                multiplier: 0.95,
            },
        }
    });
    item_templates["Long ash wood shaft"] = new WeaponComponent({
        name: "Long ash wood shaft", 
        description: "A long shaft for a spear.",
        component_type: "long handle",
        value: 150,
        component_tier: 3,
			   component_stats: {
            attack_points: {
                multiplier: 1.25,
            },
        }
		
    });
	    item_templates["Long mahogany wood shaft"] = new WeaponComponent({
        name: "Long mahogany wood shaft", 
        description: "A long shaft for a spear.",
        component_type: "long handle",
        value: 225,
        component_tier: 4,
		   component_stats: {
            attack_speed: {
                multiplier: 1.05,
            },
				        attack_points: {
                multiplier: 1.5,
            },
        }
    });
	

    item_templates["Cheap short iron hilt"] = new WeaponComponent({
        name: "Cheap short iron hilt", description: "A short handle for a sword or maybe a dagger, heavy",
        component_type: "short handle",
        value: 56,
        component_tier: 1,
        component_stats: {
            attack_speed: {
                multiplier: 0.9,
            },
            attack_power: {
                multiplier: 1.05,
            }
        }
    });

    item_templates["Short iron hilt"] = new WeaponComponent({
        name: "Short iron hilt", description: "A short handle for a sword or maybe a dagger, heavy",
        component_type: "short handle",
        value: 80,
        component_tier: 2,
        component_stats: {
            attack_power: {
                multiplier: 1.05,
            }
        }
    });

    item_templates["Short blacksteel hilt"] = new WeaponComponent({
        name: "Short blacksteel hilt", description: "A short handle for a sword or maybe a dagger, heavy",
        component_type: "short handle",
        value: 120,
        component_tier: 3,
        component_stats: {
            attack_power: {
                multiplier: 1.1,
            },
			        attack_points: {
                multiplier: 1.25,
            },
        }
    });
    item_templates["Short mithril hilt"] = new WeaponComponent({
        name: "Short mithril hilt", description: "A short handle for a sword or maybe a dagger, heavy",
        component_type: "short handle",
        value: 180,
        component_tier: 4,
        component_stats: {
            attack_power: {
                multiplier: 1.15,
            },
				        attack_points: {
                multiplier: 1.5,
            },
        }
    });

    item_templates["Cheap medium iron handle"] = new WeaponComponent({
        name: "Cheap medium iron handle", description: "A medium handle for an axe or a hammer, very heavy",
        component_type: "medium handle",
        value: 64,
        component_tier: 1,
        component_stats: {
            attack_speed: {
                multiplier: 0.7,
            },
            attack_power: {
                multiplier: 1.2,
            }
        }
    });

    item_templates["Medium iron handle"] = new WeaponComponent({
        name: "Medium iron handle", description: "A medium handle for an axe or a hammer, very heavy",
        component_type: "medium handle",
        value: 100,
        component_tier: 2,
        component_stats: {
            attack_speed: {
                multiplier: 0.8,
            },
            attack_power: {
                multiplier: 1.2,
            },
			
        }
    });

    item_templates["Medium blacksteel handle"] = new WeaponComponent({
        name: "Medium blacksteel handle", description: "A medium handle for an axe or a hammer, very heavy",
        component_type: "medium handle",
        value: 150,
        component_tier: 3,
        component_stats: {
            attack_speed: {
                multiplier: 0.8,
            },
            attack_power: {
                multiplier: 1.27,
            },
			        attack_points: {
                multiplier: 1.25,
            },
        }
    });
    item_templates["Medium mithril handle"] = new WeaponComponent({
        name: "Medium mithril handle", description: "A medium handle for an axe or a hammer, very heavy",
        component_type: "medium handle",
        value: 225,
        component_tier: 4,
        component_stats: {
            attack_speed: {
                multiplier: 0.9,
            },
            attack_power: {
                multiplier: 1.27,
            },
				        attack_points: {
                multiplier: 1.5,
            },
        }
    });

    item_templates["Cheap long iron shaft"] = new WeaponComponent({
        name: "Cheap long iron shaft", description: "A long shaft for a spear, extremely heavy",
        component_type: "long handle",
        value: 92,
        component_tier: 1,
        component_stats: {
            attack_speed: {
                multiplier: 0.5,
            },
            attack_power: {
                multiplier: 1.6,
            }
        }
    });

    item_templates["Long iron shaft"] = new WeaponComponent({
        name: "Long iron shaft", 
        description: "A long shaft for a spear,  extremely heavy",
        component_type: "long handle",
        value: 128,
        component_tier: 2,
        component_stats: {
            attack_speed: {
                multiplier: 0.6,
            },
            attack_power: {
                multiplier: 1.6,
            },
			
        }
    });

    item_templates["Long blacksteel shaft"] = new WeaponComponent({
        name: "Long blacksteel shaft", 
        description: "A long shaft for a spear, extremely heavy",
        component_type: "long handle",
        value: 192,
        component_tier: 3,
        component_stats: {
            attack_speed: {
                multiplier: 0.6,
            },
            attack_power: {
                multiplier: 1.75,
            },
			        attack_points: {
                multiplier: 1.25,
            },
        }
    });
	
    item_templates["Long mithril shaft"] = new WeaponComponent({
        name: "Long mithril shaft", 
        description: "A long shaft for a spear, extremely heavy",
        component_type: "long handle",
        value: 288,
        component_tier: 3,
        component_stats: {
            attack_speed: {
                multiplier: 0.6,
            },
            attack_power: {
                multiplier: 1.9,
            },
			        attack_points: {
                multiplier: 1.5,
            },
        }
    });

    item_templates["Short weak bone hilt"] = new WeaponComponent({
        name: "Short weak bone hilt", description: "A short handle for a sword or maybe a dagger, made of a weak monster's bone",
        component_type: "short handle",
        value: 120,
        component_tier: 3,
        component_stats: {
            attack_power: {
                multiplier: 1.05,
            },
            attack_speed: {
                multiplier: 1.05,
            },
			        attack_points: {
                multiplier: 1.25,
            },
        },
    });

    item_templates["Medium weak bone handle"] = new WeaponComponent({
        name: "Medium weak bone handle", description: "A medium handle for an axe or a hammer, made of a weak monster's bone",
        component_type: "medium handle",
        value: 150,
        component_tier: 3,
        component_stats: {
            attack_speed: {
                multiplier: 0.95,
            },
            attack_power: {
                multiplier: 1.1,
            },
			        attack_points: {
                multiplier: 1.25,
            },
        }
    });

    item_templates["Long weak bone shaft"] = new WeaponComponent({
        name: "Long weak bone shaft", 
        description: "A long shaft for a spear, made of weak monster's bone",
        component_type: "long handle",
        value: 192,
        component_tier: 3,
        component_stats: {
            attack_speed: {
                multiplier: 0.8,
            },
            attack_power: {
                multiplier: 1.5,
            },
			        attack_points: {
                multiplier: 1.25,
            },
        }
    });
	// special
	
	    item_templates["Order Blade"] = new WeaponComponent({
        name: "Order Blade", 
		description: "Good blade made of iron, with a perfect length for a sword",
        component_type: "long blade",
        value: 210,
        name_prefix: "Order",
		name_override: "Sword of the Order",
        component_tier: 2,
        attack_value: 14,
        component_stats: {
            attack_speed: {
                multiplier: 1.15,
            },
            crit_rate: {
                flat: 0.08,
            },
        }
    });
	
	

})();

//weapons:
(function(){
		    item_templates["Sword of the Order"] = new Weapon({
        components: {
            head: "Order Blade",
            handle: "Short wooden hilt",
        }
    });	
	
    item_templates["Cheap iron spear"] = new Weapon({
        components: {
            head: "Cheap short iron blade",
            handle: "Simple long wooden shaft"
        }
    });
    item_templates["Iron spear"] = new Weapon({
        components: {
            head: "Short iron blade",
            handle: "Simple long wooden shaft"
        }
    });
    item_templates["Blacksteel spear"] = new Weapon({
        components: {
            head: "Short blacksteel blade",
            handle: "Long wooden shaft"
        }
    });
    item_templates["Mithril spear"] = new Weapon({
        components: {
            head: "Short mithril blade",
            handle: "Long wooden shaft"
        }
    });

    item_templates["Cheap iron dagger"] = new Weapon({
        components: {
            head: "Cheap short iron blade",
            handle: "Simple short wooden hilt",
        }
    });
    item_templates["Iron dagger"] = new Weapon({
        components: {
            head: "Short iron blade",
            handle: "Simple short wooden hilt",
        }
    });
    item_templates["Blacksteel dagger"] = new Weapon({
        components: {
            head: "Short blacksteel blade",
            handle: "Short wooden hilt",
        }
    });
    item_templates["Mithril dagger"] = new Weapon({
        components: {
            head: "Short mithril blade",
            handle: "Short wooden hilt",
        }
    });

    item_templates["Cheap iron sword"] = new Weapon({
        components: {
            head: "Cheap long iron blade",
            handle: "Simple short wooden hilt",
        }
    });
    item_templates["Iron sword"] = new Weapon({
        components: {
            head: "Long iron blade",
            handle: "Simple short wooden hilt",
        },
    });
    item_templates["Blacksteel sword"] = new Weapon({
        components: {
            head: "Long blacksteel blade",
            handle: "Short wooden hilt",
        }
    });
    item_templates["Mithril sword"] = new Weapon({
        components: {
            head: "Long mithril blade",
            handle: "Short wooden hilt",
        }
    });

    item_templates["Cheap iron axe"] = new Weapon({
        components: {
            head: "Cheap iron axe head",
            handle: "Simple medium wooden handle",
        }
    });
    item_templates["Iron axe"] = new Weapon({
        components: {
            head: "Iron axe head",
            handle: "Simple medium wooden handle",
        },
    });
    item_templates["Blacksteel axe"] = new Weapon({
        components: {
            head: "Blacksteel axe head",
            handle: "Medium wooden handle",
        }
    });
    item_templates["Mithril axe"] = new Weapon({
        components: {
            head: "Mithril axe head",
            handle: "Medium wooden handle",
        }
    });

    item_templates["Cheap iron battle hammer"] = new Weapon({
        components: {
            head: "Cheap iron hammer head",
            handle: "Simple medium wooden handle",
        }
    });
    item_templates["Iron battle hammer"] = new Weapon({
        components: {
            head: "Iron hammer head",
            handle: "Simple medium wooden handle",
        }
    });
    item_templates["Blacksteel battle hammer"] = new Weapon({
        components: {
            head: "Blacksteel hammer head",
            handle: "Medium wooden handle",
        }
    });
    item_templates["Mithril battle hammer"] = new Weapon({
        components: {
            head: "Mithril hammer head",
            handle: "Medium wooden handle",
        }
    });	


   item_templates["Gilded Glaive"] = new Weapon({
        components: {
            head: "Short platinum blade",
            handle: "Long wooden shaft"
        },
		special_effects: [  
			{ name: "greed", value: 2 },
		]
    });

    item_templates["Ducat Dirk"] = new Weapon({
        components: {
            head: "Short platinum blade",
            handle: "Short wooden hilt",
        },
				special_effects: [  
			{ name: "greed", value: 1 },
		]
    });
    item_templates["Coin Cutlass"] = new Weapon({
        components: {
            head: "Long platinum blade",
            handle: "Short wooden hilt",
        },
				special_effects: [  
			{ name: "greed", value: 2 },
		]
    });

    item_templates["Banker's Battleaxe"] = new Weapon({
        components: {
            head: "Platinum axe head",
            handle: "Medium wooden handle",
        },
				special_effects: [  
			{ name: "greed", value: 3 },
		]
    });

    item_templates["Money Mallet"] = new Weapon({
        components: {
            head: "Platinum hammer head",
            handle: "Medium wooden handle",
        },
				special_effects: [  
			{ name: "greed", value: 3 },
		]
    });	

	

})();

//armor components:
(function(){
    item_templates["Wolf leather helmet armor"] = new ArmorComponent({
        name: "Wolf leather helmet armor", 
        description: "Strenghtened wolf leather, ready to be used as a part of a helmet",
        component_type: "helmet exterior",
        value: 600,
        component_tier: 2,
        full_armor_name: "Wolf leather helmet",
        defense_value: 2,
        stats: {
            agility: {
                multiplier: 0.95,
            }
        }
    });

    item_templates["Boar leather helmet armor"] = new ArmorComponent({
        name: "Boar leather helmet armor", 
        description: "Strong boar leather, ready to be used as a part of a helmet",
        component_type: "helmet exterior",
        value: 1000,
        component_tier: 3,
        full_armor_name: "Boar leather helmet",
        defense_value: 3,
        stats: {
            agility: {
                multiplier: 0.95,
            }
        }
    });

    item_templates["Wolf leather chestplate armor"] = new ArmorComponent({
        id: "Wolf leather chestplate armor",
        name: "Wolf leather cuirass",
        description: "Simple cuirass made of solid wolf leather, all it needs now is something softer to wear under it.",
        component_type: "chestplate exterior",
        value: 1200,
        component_tier: 2,
        full_armor_name: "Wolf leather armor",
        defense_value: 4,
        stats: {
            agility: {
                multiplier: 0.95,
            }
        }
    });
    item_templates["Boar leather chestplate armor"] = new ArmorComponent({
        id: "Boar leather chestplate armor",
        name: "Boar leather cuirass",
        description: "String cuirass made of boar leather.",
        component_type: "chestplate exterior",
        value: 2000,
        component_tier: 3,
        full_armor_name: "Boar leather armor",
        defense_value: 6,
        stats: {
            agility: {
                multiplier: 0.95,
            }
        }
    });
    item_templates["Wolf leather greaves"] = new ArmorComponent({
        name: "Wolf leather greaves",
        description: "Greaves made of wolf leather. Just attach them onto some pants and you are ready to go.",
        component_type: "leg armor exterior",
        value: 600,
        component_tier: 2,
        full_armor_name: "Wolf leather armored pants",
        defense_value: 2,
        stats: {
            agility: {
                multiplier: 0.95,
            }
        }
    });

    item_templates["Boar leather greaves"] = new ArmorComponent({
        name: "Boar leather greaves",
        description: "Greaves made of thick boar leather. Just attach them onto some pants and you are ready to go.",
        component_type: "leg armor exterior",
        value: 1000,
        component_tier: 3,
        full_armor_name: "Boar leather armored pants",
        defense_value: 3,
        stats: {
            agility: {
                multiplier: 0.95,
            }
        }
    });
    item_templates["Wolf leather glove armor"] = new ArmorComponent({
        name: "Wolf leather glove armor",
        description: "Pieces of wolf leather shaped for gloves.",
        component_type: "glove exterior",
        value: 600,
        component_tier: 2,
        full_armor_name: "Wolf leather gloves",
        defense_value: 2,
    });

    item_templates["Boar leather glove armor"] = new ArmorComponent({
        name: "Boar leather glove armor",
        description: "Pieces of boar leather shaped for gloves.",
        component_type: "glove exterior",
        value: 1000,
        component_tier: 3,
        full_armor_name: "Boar leather gloves",
        defense_value: 3,
    });

    item_templates["Wolf leather shoe armor"] = new ArmorComponent({
        name: "Wolf leather shoe armor",
        description: "Pieces of wolf leather shaped for shoes.",
        component_type: "shoes exterior",
        value: 600,
        component_tier: 2,
        full_armor_name: "Wolf leather shoes",
        defense_value: 2,
    });

    item_templates["Boar leather shoe armor"] = new ArmorComponent({
        name: "Boar leather shoe armor",
        description: "Pieces of boar leather shaped for shoes.",
        component_type: "shoes exterior",
        value: 1000,
        component_tier: 3,
        full_armor_name: "Boar leather shoes",
        defense_value: 3,
    });

    item_templates["Iron chainmail helmet armor"] = new ArmorComponent({
        name: "Iron chainmail helmet armor",
        description: "Best way to keep your head in one piece",
        component_type: "helmet exterior",
        value: 800,
        component_tier: 2,
        full_armor_name: "Iron chainmail helmet",
        defense_value: 4,
        stats: {
            attack_speed: {
                multiplier: 0.98,
            },
            agility: {
                multiplier: 0.9,
            }
        }
    });
    item_templates["Iron chainmail vest"] = new ArmorComponent({
        name: "Iron chainmail vest",
        description: "Basic iron chainmail. Nowhere near as strong as a plate armor",
        component_type: "chestplate exterior",
        value: 1600,
        component_tier: 2,
        full_armor_name: "Iron chainmail armor",
        defense_value: 8,
        stats: {
            attack_speed: {
                multiplier: 0.98,
            },
            agility: {
                multiplier: 0.9,
            }
        }
    });
    item_templates["Iron chainmail greaves"] = new ArmorComponent({
        name: "Iron chainmail greaves",
        description: "Greaves made of iron chainmail. Just attach them onto some pants and you are ready to go.",
        component_type: "leg armor exterior",
        value: 800,
        component_tier: 2,
        full_armor_name: "Iron chainmail pants",
        defense_value: 4,
        stats: {
            attack_speed: {
                multiplier: 0.98,
            },
            agility: {
                multiplier: 0.9,
            }
        }
    });
    item_templates["Iron chainmail glove"] = new ArmorComponent({
        name: "Iron chainmail glove",
        description: "Iron chainmail in a form ready to be applied onto a glove.",
        component_type: "glove exterior",
        value: 800,
        component_tier: 2,
        full_armor_name: "Iron chainmail gloves",
        defense_value: 4,
        stats: {
            attack_speed: {
                multiplier: 0.98,
            },
            agility: {
                multiplier: 0.9,
            }
        }
    });

    item_templates["Iron chainmail shoes"] = new ArmorComponent({
        name: "Iron chainmail shoes",
        description: "Iron chainmail in a form ready to be applied onto a pair of shoes.",
        component_type: "shoes exterior",
        value: 800,
        component_tier: 2,
        full_armor_name: "Iron chainmail boots",
        defense_value: 4,
        stats: {
            agility: {
                multiplier: 0.9,
            }
        }
    });
})();

//clothing (functions both as weak armor and as an armor component):
(function(){
    item_templates["Cheap leather vest"] = new Armor({
        name: "Cheap leather vest", 
        description: "Vest providing very low protection. Better not to know what's it made from", 
        value: 100,
        component_type: "chestplate interior",
        base_defense: 2,
        component_tier: 1,
        stats: {
            attack_speed: {
                multiplier: 0.99,
            },
        }
    });
    item_templates["Leather vest"] = new Armor({
        name: "Leather vest", 
        description: "Comfortable leather vest, offering a low protection.", 
        value: 600,
        component_type: "chestplate interior",
        base_defense: 2,
        component_tier: 2,
    });

    item_templates["Cheap leather pants"] = new Armor({
        name: "Cheap leather pants", 
        description: "Leather pants made from cheapest resources available.", 
        value: 100,
        component_type: "leg armor interior",
        base_defense: 1,
        component_tier: 1,
        stats: {
            attack_speed: {
                multiplier: 0.99,
            },
        }
    });
    item_templates["Leather pants"] = new Armor({
        name: "Leather pants", 
        description: "Solid leather pants.", 
        value: 600,
        component_type: "leg armor interior",
        base_defense: 2,
        component_tier: 2,
    });

    item_templates["Cheap leather hat"] = new Armor({
        name: "Cheap leather hat", 
        description: "A cheap leather hat to protect your head.", 
        value: 100,
        component_type: "helmet interior",
        base_defense: 1,
        component_tier: 1,
        stats: {
            attack_speed: {
                multiplier: 0.99,
            },
        }
    });

    item_templates["Leather hat"] = new Armor({
        name: "Leather hat", 
        description: "A nice leather hat to protect your head.", 
        value: 600,
        component_type: "helmet interior",
        base_defense: 2,
        component_tier: 2,
    });

    item_templates["Leather gloves"] = new Armor({
        name: "Leather gloves", 
        description: "Strong leather gloves, perfect for handling rough and sharp objects.", 
        value: 600,
        component_type: "glove interior",
        base_defense: 1,
        component_tier: 2,
    });

    item_templates["Cheap leather shoes"] = new Armor({
        name: "Cheap leather shoes",
        description: "Shoes made of thin and cheap leather. Even then, they are in every single aspect better than not having any.", 
        value: 100,
        component_type: "shoes interior",
        base_defense: 0,
        component_tier: 1,
        stats: {
            agility: {
                multiplier: 1.05,
            },
        }
    });
    item_templates["Leather shoes"] = new Armor({
        name: "Leather shoes", 
        description: "Solid shoes made of leather, a must have for any traveler", 
        value: 600,
        component_type: "shoes interior",
        base_defense: 1,
        component_tier: 2,
        stats: {
            attack_speed: {
                multiplier: 1.02,
            },
            agility: {
                multiplier: 1.1,
            },
        }
    });

    item_templates["Wool shirt"] = new Armor({
        name: "Wool shirt",
        description: "It's thick enough to weaken a blow, but you shouldn't hope for much. On the plus side, it's light and doesn't block your moves.", 
        value: 600,
        component_type: "chestplate interior",
        base_defense: 1,
        component_tier: 2,
        stats: {
            attack_speed: {
                multiplier: 1.01,
            },
            agility: {
                multiplier: 1.02,
            },
        }
    });

    item_templates["Wool pants"] = new Armor({
        name: "Wool pants", 
        description: "Nice woollen pants. Slightly itchy.",
        value: 600,
        component_type: "leg armor interior",
        base_defense: 1,
        component_tier: 2,
    });

    item_templates["Wool hat"] = new Armor({
        name: "Wool hat", 
        description: "Simple woollen hat to protect your head.",
        value: 600,
        component_type: "helmet interior",
        base_defense: 1,
        component_tier: 2,
        stats: {
            attack_speed: {
                multiplier: 1.01,
            },
            agility: {
                multiplier: 1.01,
            },
        }
    });

    item_templates["Wool gloves"] = new Armor({
        name: "Wool gloves",
        description: "Warm and comfy, but they don't provide much protection.",
        value: 600,
        component_type: "glove interior",
        base_defense: 1,
        component_tier: 2,
    });
})();

//armors:
(function(){
    //predefined full (int+ext) armors go here
    item_templates["Wolf leather armor"] = new Armor({
        components: {
            internal: "Leather vest",
            external: "Wolf leather chestplate armor",
        }
    });
    item_templates["Wolf leather helmet"] = new Armor({
        components: {
            internal: "Leather hat",
            external: "Wolf leather helmet armor",
        }
    });
    item_templates["Wolf leather armored pants"] = new Armor({
        components: {
            internal: "Leather pants",
            external: "Wolf leather greaves",
        }
    });

    item_templates["Iron chainmail armor"] = new Armor({
        components: {
            internal: "Leather vest",
            external: "Iron chainmail vest",
        }
    });
    item_templates["Iron chainmail helmet"] = new Armor({
        components: {
            internal: "Leather hat",
            external: "Iron chainmail helmet armor",
        }
    });
    item_templates["Iron chainmail pants"] = new Armor({
        components: {
            internal: "Leather pants",
            external: "Iron chainmail greaves",
        }
    });
})();

//shield components:
(function(){
    item_templates["Cheap wooden shield base"] = new ShieldComponent({
        name: "Cheap wooden shield base", description: "Cheap shield component made of wood, basically just a few planks barely holding together", 
        value: 20, 
        shield_strength: 1, 
        shield_name: "Cheap wooden shield",
        component_tier: 1,
        component_type: "shield base",
    });

    item_templates["Crude wooden shield base"] = new ShieldComponent({
        name: "Crude wooden shield base", description: "A shield base of rather bad quality, but at least it won't fall apart by itself", 
        value: 40,
        shield_strength: 3,
        shield_name: "Crude wooden shield",
        component_tier: 1,
        component_type: "shield base",
    });
    item_templates["Wooden shield base"] = new ShieldComponent({
        name: "Wooden shield base", description: "Proper wooden shield base, although it could use some additional reinforcement", 
        value: 100,
        shield_strength: 5,
        shield_name: "Wooden shield",
        component_tier: 2,
        component_type: "shield base",
    });
    item_templates["Crude iron shield base"] = new ShieldComponent({
        name: "Crude iron shield base", description: "Heavy shield base made of low quality iron.", 
        value: 160,
        shield_strength: 7,
        shield_name: "Crude iron shield",
        component_tier: 2,
        component_type: "shield base",
        stats: {
            attack_speed: {
                multiplier: 0.9,
            }
        }
    });
    item_templates["Iron shield base"] = new ShieldComponent({
        name: "Iron shield base", 
        description: "Solid and strong shield base, although it's quite heavy", 
        value: 260,
        shield_strength: 10,
        shield_name: "Iron shield",
        component_tier: 3,
        component_type: "shield base",
        stats: {
            attack_speed: {
                multiplier: 0.95,
            }
        }
    });
    item_templates["Basic shield handle"] = new ShieldComponent({
        id: "Basic shield handle",
        name: "Crude wooden shield handle", 
        description: "A simple handle for holding the shield", 
        value: 10,
        component_tier: 1,
        component_type: "shield handle",
    });

    item_templates["Wooden shield handle"] = new ShieldComponent({
        name: "Wooden shield handle", 
        description: "A decent wooden handle for holding the shield", 
        value: 40,
        component_tier: 2,
        component_type: "shield handle",
        stats: {
            block_strength: {
                multiplier: 1.1,
            }
        }
    });

})();

//shields:
(function(){
    item_templates["Cheap wooden shield"] = new Shield({
        components: {
            shield_base: "Cheap wooden shield base",
            handle: "Basic shield handle",
        }
    });

    item_templates["Crude wooden shield"] = new Shield({
        components: {
            shield_base: "Crude wooden shield base",
            handle: "Basic shield handle",
        }
    });

    item_templates["Wooden shield"] = new Shield({
        components: {
            shield_base: "Wooden shield base",
            handle: "Wooden shield handle",
        }
    });

    item_templates["Crude iron shield"] = new Shield({
        components: {
            shield_base: "Crude iron shield base",
            handle: "Basic shield handle",
        }
    });

    item_templates["Iron shield"] = new Shield({
        components: {
            shield_base: "Iron shield base",
            handle: "Wooden shield handle",
        }
    });
})();

//trinkets:
(function(){
    item_templates["Wolf trophy"] = new Artifact({
        name: "Wolf trophy",
        value: 50,
        stats: {
            attack_speed: {
                multiplier: 1.05,
            },
            crit_rate: {
                flat: 0.01,
            },
        }
    });

    item_templates["Boar trophy"] = new Artifact({
        name: "Boar trophy",
        value: 80,
        stats: {
            attack_power: {
                multiplier: 1.1,
            },
            crit_multiplier: {
                flat: 0.2,
            },
        }
    });

    item_templates["Slayer trophy"] = new Artifact({
        name: "Slayer trophy",
        value: 200,
        stats: {
            attack_power: {
                multiplier: 1.2,
            },
            crit_multiplier: {
                flat: 0.4,
            },
        }
    });
    item_templates["Knight trophy"] = new Artifact({
        name: "Knight trophy",
        value: 200,
        stats: {
            "max_health": {
                multiplier: 1.2,
            },
            "defense": {
                flat: 5,
            },
        }
    });
    item_templates["Scholar trophy"] = new Artifact({
        name: "Scholar trophy",
        value: 200,
        stats: {
            "max_mana": {
                multiplier: 1.2,
            },
            "magic": {
                flat: 30,
            },
        }
    });
    item_templates["Fireseeker trophy"] = new Artifact({
        name: "Fireseeker trophy",
        value: 200,
        stats: {
            "max_health": {
                multiplier: 1.2,
            },
            "magic": {
                flat: 30,
            },
        }
    });
})();

//tools:
(function(){
    item_templates["Old pickaxe"] = new Tool({
        name: "Old pickaxe",
        description: "An old pickaxe that has seen better times, but is still usable",
        value: 10,
        equip_slot: "pickaxe",
    });

    item_templates["Old axe"] = new Tool({
        name: "Old axe",
        description: "An old axe that has seen better times, but is still usable",
        value: 10,
        equip_slot: "axe",
    });

    item_templates["Old sickle"] = new Tool({
        name: "Old sickle",
        description: "An old herb sickle that has seen better times, but is still usable",
        value: 10,
        equip_slot: "sickle",
    });
	    item_templates["Old rod"] = new Tool({
        name: "Old rod",
        description: "An old fishing rod that has seen better times, but is still usable",
        value: 10,
        equip_slot: "rod",
    });
    item_templates["Upstart pickaxe"] = new Tool({
        name: "Upstart pickaxe",
        description: "Upstart pickaxe. +10% Tool Bonus",
        value: 1000,
		tool_bonus: 10,
        equip_slot: "pickaxe",
    });
	    item_templates["Upstart axe"] = new Tool({
        name: "Upstart axe",
        description: "Upstart axe. +10% Tool Bonus",
        value: 1000,
		tool_bonus: 10,
        equip_slot: "axe",
    });
    item_templates["Upstart sickle"] = new Tool({
        name: "Upstart sickle",
        description: "Upstart sickle. +10% Tool Bonus",
        value: 1000,
		tool_bonus: 10,
        equip_slot: "sickle",
    });
	    item_templates["Upstart rod"] = new Tool({
        name: "Upstart rod",
        description: "Upstart rod. +10% Tool Bonus",
        value: 1000,
		tool_bonus: 10,
        equip_slot: "rod",
    });	

    item_templates["Journeyman pickaxe"] = new Tool({
        name: "Journeyman pickaxe",
        description: "Journeyman pickaxe. +20% Tool Bonus",
        value: 10000,
		tool_bonus: 20,
        equip_slot: "pickaxe",
    });
	    item_templates["Journeyman axe"] = new Tool({
        name: "Journeyman axe",
        description: "Journeyman axe. +20% Tool Bonus",
        value: 10000,
		tool_bonus: 20,
        equip_slot: "axe",
    });
    item_templates["Journeyman sickle"] = new Tool({
        name: "Journeyman sickle",
        description: "Journeyman sickle. +20% Tool Bonus",
        value: 10000,
		tool_bonus: 20,
        equip_slot: "sickle",
    });
	    item_templates["Journeyman rod"] = new Tool({
        name: "Journeyman rod",
        description: "Journeyman rod. +20% Tool Bonus",
        value: 10000,
		tool_bonus: 20,
        equip_slot: "rod",
    });
    item_templates["Expert pickaxe"] = new Tool({
        name: "Expert pickaxe",
        description: "Expert pickaxe. +35% Tool Bonus",
        value: 50000,
		tool_bonus: 35,
        equip_slot: "pickaxe",
    });
	    item_templates["Expert axe"] = new Tool({
        name: "Expert axe",
        description: "Expert axe. +35% Tool Bonus",
        value: 50000,
		tool_bonus: 35,
        equip_slot: "axe",
    });
    item_templates["Expert sickle"] = new Tool({
        name: "Expert sickle",
        description: "Expert sickle. +35% Tool Bonus",
        value: 50000,
		tool_bonus: 35,
        equip_slot: "sickle",
    });
	    item_templates["Expert rod"] = new Tool({
        name: "Expert rod",
        description: "Expert rod. +35% Tool Bonus",
        value: 50000,
		tool_bonus: 35,
        equip_slot: "rod",
    });
    item_templates["Super pickaxe"] = new Tool({
        name: "Super pickaxe",
        description: "A pickaxe so powerful it may well have been forged by the gods themselves. +50% Tool Bonus",
        value: 100000,
		tool_bonus: 50,
        equip_slot: "pickaxe",
    });
	    item_templates["Super axe"] = new Tool({
        name: "Super axe",
        description: "An axe so powerful it may well have been forged by the gods themselves. +50% Tool Bonus",
        value: 100000,
		tool_bonus: 50,
        equip_slot: "axe",
    });
    item_templates["Super sickle"] = new Tool({
        name: "Super sickle",
        description: "A herb sickle so powerful it may well have been forged by the gods themselves. +50% Tool Bonus",
        value: 100000,
		tool_bonus: 50,
        equip_slot: "sickle",
    });
	    item_templates["Super rod"] = new Tool({
        name: "Super rod",
        description: "A fishing rod so powerful it may well have been forged by the gods themselves. +50% Tool Bonus",
        value: 100000,
		tool_bonus: 50,
        equip_slot: "rod",
    });
})();

//usables:
(function(){
	
	item_templates["Minor Healing Salve"] = new UsableItem({
    name: "Minor Healing Salve",
    description: "Heals a small amount of health instantly.",
    value: 30,
	tags: { potion: true },
    instant_health_recovery: 15,
});

item_templates["Standard Healing Potion"] = new UsableItem({
    name: "Standard Healing Potion",
    description: "Restores a moderate amount of health right away.",
    value: 120,
	tags: { potion: true },
    instant_health_recovery: 50,
});

item_templates["Major Healing Elixir"] = new UsableItem({
    name: "Major Healing Elixir",
    description: "Rapidly recovers a large portion of health.",
    value: 1000,
	tags: { potion: true },
    instant_health_recovery: 300,
});
// healing active effects
	
item_templates["Discount healing powder"] = new UsableItem({
        name: "Discount healing powder", 
        description: "Not very potent, but can still make body heal noticeably faster for quite a while. Budget priced.", 
        value: 10,
        effects: [{effect: "Weak healing powder", duration: 120}],
    });




    item_templates["Weak healing powder"] = new UsableItem({
        name: "Weak healing powder", 
        description: "Not very potent, but can still make body heal noticeably faster for quite a while", 
        value: 40,
        effects: [{effect: "Weak healing powder", duration: 120}],
    });
	
    item_templates["Antidote"] = new UsableItem({
        name: "Antidote", 
        description: "Neutralizes common poisons.", 
        value: 40,
        cures: ["Poison"],
    });
item_templates["Panacea"] = new UsableItem({
    name: "Panacea", 
    description: "A miracle cure that removes all negative status effects", 
    value: 200,
    cures: ["Poison", "Freeze", "Burn", "Stun"] // etc.
});

    item_templates["Oneberry juice"] = new UsableItem({
        name: "Oneberry juice", 
        description: "Tastes kinda nice and provides a quick burst of healing", 
        value: 80,
		gluttony_value: 30,
        effects: [{effect: "Weak healing potion", duration: 10}],
    });

item_templates["Burn Ointment"] = new UsableItem({
    name: "Burn Ointment",
    description: "Soothes scorched skin and neutralizes burn effects.",
    value: 50,
    cures: ["Burn"],
});

item_templates["Cryogel"] = new UsableItem({
    name: "Cryogel",
    description: "Rapidly warms the body, countering frostbite and freezing effects.",
    value: 50,
    cures: ["Freeze"],
});

item_templates["Focus Salts"] = new UsableItem({
    name: "Focus Salts",
    description: "Sharpen the senses and awaken the stunned mind.",
    value: 50,
    cures: ["Stun"],
});
//Immunity items

item_templates["Fireproof Draught"] = new UsableItem({
    name: "Fireproof Draught",
    description: "Grants temporary immunity to burns.",
    value: 300,
    effects: [{effect: "Burn immunity", duration: 60}],
	cures: ["Burn"],
});

item_templates["Cryo Coating"] = new UsableItem({
    name: "Cryo Coating",
    description: "Prevents the body from freezing for a short time.",
    value: 300,
    effects: [{effect: "Freeze immunity", duration: 60}],
	cures: ["Freeze"],
});

item_templates["Shockguard Brew"] = new UsableItem({
    name: "Shockguard Brew",
    description: "Protects the nervous system from stunning effects.",
    value: 300,
    effects: [{effect: "Stun immunity", duration: 60}],
	cures: ["Stun"],
});

item_templates["Venom Ward"] = new UsableItem({
    name: "Venom Ward",
    description: "Immunizes the body against most poisons temporarily.",
    value: 300,
    effects: [{effect: "Poison immunity", duration: 60}],
	cures: ["Poison"],
});

/// elixirs

item_templates["Elixir of Strength"] = new UsableItem({
    name: "Elixir of Strength",
    description: "A small but permanent boost to raw physical power.",
    value: 10000,
	 tags: { elixir: true },
    elixir_bonus: {
        stats: {
            "strength": {flat: 1},
        },
    },
});

item_templates["Elixir of Dexterity"] = new UsableItem({
    name: "Elixir of Dexterity",
    description: "A small but permanent boost to coordination and precision.",
    value: 10000,
	tags: { elixir: true },
    elixir_bonus: {
        stats: {
            "dexterity": {flat: 1},
        },
    },
});

item_templates["Elixir of Agility"] = new UsableItem({
    name: "Elixir of Agility",
    description: "A small but permanent boost to quickness and mobility.",
    value: 10000,
	tags: { elixir: true },
    elixir_bonus: {
        stats: {
            "agility": {flat: 1},
        },
    },
});

item_templates["Elixir of Intuition"] = new UsableItem({
    name: "Elixir of Intuition",
    description: "A small but permanent boost to perception and gut feeling.",
    value: 10000,
	tags: { elixir: true },
    elixir_bonus: {
        stats: {
            "intuition": {flat: 1},
        },
    },
});

item_templates["Elixir of Magic"] = new UsableItem({
    name: "Elixir of Magic",
    description: "A small but permanent boost to magical ability.",
    value: 10000,
	tags: { elixir: true },
    elixir_bonus: {
        stats: {
            "magic": {flat: 1},
        },
    },
});

// foods


item_templates["Grilled goo"] = new UsableItem({
        name: "Grilled goo", 
        description: "If you're really, really desperate...", 
        value: 2,
		gluttony_value: 1,
        effects: [{effect: "Basic meal", duration: 10}],
    });

item_templates["Discount bread"] = new UsableItem({
        name: "Discount bread", 
        description: "Big piece of an old bread, still edible. Budget priced.", 
        value: 5,
		gluttony_value: 20,
        effects: [{effect: "Basic meal", duration: 60}],
    });

item_templates["Stale bread"] = new UsableItem({
        name: "Stale bread", 
        description: "Big piece of an old bread, still edible.", 
        value: 20,
		gluttony_value: 20,
        effects: [{effect: "Basic meal", duration: 60}],
    });

    item_templates["Fresh bread"] = new UsableItem({
        name: "Fresh bread", 
        description: "Freshly baked bread, delicious.", 
        value: 40,
		gluttony_value: 100,
        effects: [{effect: "Basic meal", duration: 120}],
    });
    item_templates["Turtle Soup"] = new UsableItem({
        name: "Turtle Soup", 
        description: "Turtle soup from the legendary Titan Turtle. Not great, not terrible, but undeniably disappointing.", 
        value: 10,
		gluttony_value: 40,
        effects: [{effect: "Basic meal", duration: 60}],
    });

//meat
    item_templates["Roasted rat meat"] = new UsableItem({
        name: "Roasted rat meat", 
        description: "Smell might be fine now, but it still seems like a bad idea to eat it",
        value: 10,
		gluttony_value: 150,
        effects: [{effect: "Cheap meat meal", duration: 31}, {effect: "Slight food poisoning", duration: 30}],
    });

    item_templates["Roasted purified rat meat"] = new UsableItem({
        name: "Roasted purified rat meat", 
        description: "Smells alright and should be safe to eat, yet you still have some doubts",
        value: 20,
		gluttony_value: 300,
        effects: [{effect: "Cheap meat meal", duration: 31}],
    });

//fish dish

    item_templates["Cooked Minnow"] = new UsableItem({
        name: "Cooked Minnow", 
        description: "A powerful fishy smell belies a satisfactory taste.",
        value: 20,
		gluttony_value: 300,
        effects: [{effect: "Cheap fish dish", duration: 10}],
    });
    item_templates["Cooked Sardine"] = new UsableItem({
        name: "Cooked Sardine", 
        description: "A powerful fishy smell belies a satisfactory taste.",
        value: 30,
		gluttony_value: 400,
        effects: [{effect: "Cheap fish dish", duration: 30}],
    });
    item_templates["Cooked Goldfish"] = new UsableItem({
        name: "Cooked Goldfish", 
        description: "A powerful fishy smell belies a satisfactory taste.",
        value: 40,
		gluttony_value: 500,
        effects: [{effect: "Cheap fish dish", duration: 60}],
    });
	    item_templates["Cooked Plaice"] = new UsableItem({
        name: "Cooked Plaice", 
        description: "A powerful fishy smell belies a satisfactory taste.",
        value: 50,
		gluttony_value: 600,
        effects: [{effect: "Simple fish dish", duration: 20}],
    });
	    item_templates["Cooked Bass"] = new UsableItem({
        name: "Cooked Bass", 
        description: "A powerful fishy smell belies a satisfactory taste.",
        value: 60,
		gluttony_value: 700,
        effects: [{effect: "Simple fish dish", duration: 50}],
    });
	    item_templates["Cooked Crab"] = new UsableItem({
        name: "Cooked Crab", 
        description: "A powerful fishy smell belies a satisfactory taste.",
        value: 70,
		gluttony_value: 800,
        effects: [{effect: "Simple fish dish", duration: 80}],
    });
	    item_templates["Cooked Haddock"] = new UsableItem({
        name: "Cooked Haddock", 
        description: "A powerful fishy smell belies a satisfactory taste.",
        value: 80,
		gluttony_value: 900,
        effects: [{effect: "Ordinary fish dish", duration: 30}],
    });
	    item_templates["Cooked Carp"] = new UsableItem({
        name: "Cooked Carp", 
        description: "A powerful fishy smell belies a satisfactory taste.",
        value: 90,
		gluttony_value: 1000,
        effects: [{effect: "Ordinary fish dish", duration: 60}],
    });
	    item_templates["Cooked Tuna"] = new UsableItem({
        name: "Cooked Tuna", 
        description: "A powerful fishy smell belies a satisfactory taste.",
        value: 100,
		gluttony_value: 1100,
        effects: [{effect: "Ordinary fish dish", duration: 90}],
    });
	    item_templates["Cooked Catfish"] = new UsableItem({
        name: "Cooked Catfish", 
        description: "A powerful fishy smell belies a satisfactory taste.",
        value: 110,
		gluttony_value: 1200,
        effects: [{effect: "Superior fish dish", duration: 40}],
    });
})();

//
(function(){
    item_templates["1000 Years Pill"] = new UsableItem({
        name: "1000 Years Pill", 
        description: "Brims with magical energy. Make sure you know how to gather mana before consuming it. Don't waste it.",
        value: 10000,
		mana_value: 10000,
        effects: [{effect: "Minor magic boost", duration: 300}],
    });
})();

(function(){
    item_templates["Dragon Heart"] = new UsableItem({
        name: "Dragon Heart", 
        description: "Dragon Heart",
        value: 100000,
		effects: [{effect: "Minor magic boost", duration: 300},{effect: "Cheap meat meal", duration: 300}],
    });
})();

(function(){
    item_templates["Symbiote"] = new UsableItem({
        name: "Symbiote", 
        description: "Symbiote",
        value: 1000,
		effects: [{effect: "Minor magic boost", duration: 300},{effect: "Cheap meat meal", duration: 300}],
    });
})();



item_templates["Shoddy Treasure Chest"] = new LootChestItem({
    name: "Shoddy Treasure Chest",
    description: "A shoddy wooden chest. You doubt it contains much of value.",
    value: 50,
    item_type: "USABLE",
    tags: { loot_chest: true },
    loot: [
        { item_id: "Weak healing powder", chance: 100, min_count: 5, max_count: 15 },
		{ money: true, chance: 100, min_amount: 50, max_amount: 120 }
    ],
});

item_templates["Small Treasure Chest"] = new LootChestItem({
    name: "Small Treasure Chest",
    description: "A shoddy wooden chest. You doubt it contains much of value.",
    value: 50,
    item_type: "USABLE",
    tags: { loot_chest: true },
    loot: [
        { item_id: "Weak healing powder", chance: 100, min_count: 5, max_count: 15 },
		{ money: true, chance: 100, min_amount: 50, max_amount: 120 }
    ],
});

item_templates["Sparkling Treasure Chest"] = new LootChestItem({
    name: "Sparkling Treasure Chest",
    description: "A sparkling ornate chest. It glimmers with promise.",
    value: 50,
    item_type: "USABLE",
    tags: { loot_chest: true },
	loot_pool: {
    name: "magic_spellbooks_pool",
    rolls: 2,
    count: 1,
    chance: 100
		},
    loot: [
        { item_id: "Weak healing powder", chance: 100, min_count: 5, max_count: 15 },
		{ money: true, chance: 100, min_amount: 50, max_amount: 120 }
    ],
});

Object.keys(item_templates).forEach(id => {
    item_templates[id].id = id;
})

export {
    item_templates, 
    Item, OtherItem, UsableItem, 
    Armor, Shield, Weapon, Artifact, Book, 
    WeaponComponent, ArmorComponent, ShieldComponent,
    getItem, setLootSoldCount, recoverItemPrices, round_item_price, getArmorSlot, getEquipmentValue,
    book_stats, loot_sold_count,
    rarity_multipliers,
	getItemRarity, getItemFromKey,
	getAdjustedReadingTime,
	loot_pools
};
