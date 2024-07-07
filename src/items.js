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

            then also special items of rarity "unique", that will really be unique
            so quality nor additional multiplier don't really matter on them

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

        other bonuses: 
            long handle: -agility
            short blade: +agility
*/

import { character } from "./character.js";
import { round_item_price } from "./misc.js";

const rarity_multipliers = {
    trash: 1,
    common: 1,
    uncommon: 1.1,
    rare: 1.3,
    epic: 1.6,
    legendary: 2,
    mythical: 2.5
};

const item_templates = {};

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

class Item {
    constructor({name,
                description,
                value = 0, 
                id,
                tags = {},
                }) 
    {
        this.name = name; 
        this.description = description;
        this.saturates_market = false;
        this.id = id || name;

        /**
         * Use .getValue() instead of this
         */
        this.value = value;
        this.tags = tags;
        this.tags["item"] = true;
    }

    getValue() {
        if(!this.saturates_market) {
            return round_item_price(this.value);
        }
        else {
            
            return Math.max(1, round_item_price(Math.ceil(this.value * getLootPriceModifier(this.value,(Math.max(loot_sold_count[this.getName()]?.sold - loot_sold_count[this.getName()]?.recovered,0)||0)))));
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
            const modifier = getLootPriceModifierMultiple(this.value, (Math.max(loot_sold_count[this.getName()]?.sold - loot_sold_count[this.getName()]?.recovered,0)||0)+additional_count_of_sold, count);
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

class ItemComponent extends Item {
    constructor(item_data) {
        super(item_data);
        this.item_type = "COMPONENT";
        this.stackable = false;
        this.component_tier = item_data.component_tier || 1;
        this.stats = item_data.stats || {};
        this.tags["equipment component"] = true;
        this.quality = item_data.quality || 1;
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
        //"short blade", "long blade", "axe blade", "hammer blade" for heads; "short handle", "medium handle", "long handle" for handles

        this.attack_value = item_data.attack_value || 0; //can skip this for weapon handles
        this.attack_multiplier = item_data.attack_multiplier || 1; //can skip this for weapon heads

        this.name_prefix = item_data.name_prefix; //to create a name of an item, e.g. "Sharp iron" used to create spear results in "Sharp iron spear"

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
        && item_data.component_type !== "glove interior" && item_data.component_type !== "glove exterior") {

            throw new Error(`No such armor component type as ${item_data.component_type}`);
        }
        this.component_type = item_data.component_type;
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
        this.use_effect = item_data.use_effect || {};

        this.tags["usable"] = true;
    }
}

class Equippable extends Item {
    constructor(item_data) {
        super(item_data);
        this.item_type = "EQUIPPABLE";
        this.stackable = false;
        this.components = {};

        this.quality = Math.round(item_data.quality*100)/100 || 1;

        this.tags["equippable"] = true;
    }

    getValue() {
        return round_item_price(this.value * this.quality);
    } 

    getRarity(){
        if(!this.rarity) {
            if(this.quality < 0.5) this.rarity =  "trash";
            else if(this.quality < 1.0) this.rarity = "common";
            else if(this.quality < 1.3) this.rarity = "uncommon";
            else if(this.quality < 1.6) this.rarity = "rare";
            else if(this.quality < 2.0) this.rarity = "epic";
            else if(this.quality < 2.46) this.rarity = "legendary";
            else this.rarity = "mythical";
        }
        return this.rarity;
    }

    getStats(quality){
        if(!this.stats) {
            if(this.components) {
                const stats = {};

                //iterate over components
                const components = Object.values(this.components).map(comp => item_templates[comp]).filter(comp => comp);
                for(let i = 0; i < components.length; i++) {
                    Object.keys(components[i].stats).forEach(stat => {
                        if(!stats[stat]) {
                            stats[stat] = {};
                        }

                        if(stat === "attack_power" || stat === "defense") { //skip them just in case
                            return;
                        }

                        if(components[i].stats[stat].multiplier) {
                            stats[stat].multiplier = (stats[stat].multiplier || 1) * components[i].stats[stat].multiplier;
                        }
                        if(components[i].stats[stat].flat) {
                            stats[stat].flat = (stats[stat].flat || 0) + components[i].stats[stat].flat;
                        }
                    })
                }

                //iterate over stats and apply rarity bonus if possible
                Object.keys(stats).forEach(stat => {
                    if(stats[stat].multiplier){
                        if(stats[stat].multiplier >= 1) {
                            stats[stat].multiplier = Math.round(100 * (1 + (stats[stat].multiplier - 1) * rarity_multipliers[quality || this.getRarity()]))/100;
                        } else {
                            stats[stat].multiplier = Math.round(100 * stats[stat].multiplier)/100;
                        }
                    }

                    if(stats[stat].flat){
                        if(stats[stat].flat > 0) {
                            stats[stat].flat = Math.round(100 * stats[stat].flat * rarity_multipliers[quality || this.getRarity()])/100;
                        } else {
                            stats[stat].flat = Math.round(100 * stats[stat].flat)/100;
                        }
                    }
                });

                this.stats = {...stats};
            } else {
                this.stats = {};
            }
        }

        return this.stats;
    }
}

class Artifact extends Equippable {
    constructor(item_data) {
        super(item_data);
        this.item_type = "EQUIPPABLE";
        this.stackable = false;
        this.components = undefined;
        this.equip_slot = "artifact";
        this.stats = item_data.stats;

        this.tags["artifact"] = true;
    }

    getValue() {
        return this.value;
    } 

    getStats(){
        return this.stats;
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
    }

    getShieldStrength(quality) {
        return Math.round(10 * Math.ceil(item_templates[this.components.shield_base].shield_strength * (quality || this.quality) * rarity_multipliers[quality || this.getRarity()]))/10;
    }

    getName() {
        return item_templates[this.components.shield_base].shield_name;
    }

    getValue(quality) {
        if(!this.value) {
            //value of shield base + value of handle, both multiplied by quality and rarity
            this.value = (item_templates[this.components.shield_base].value + item_templates[this.components.handle].value)
                                  * (quality || this.quality) * rarity_multipliers[quality || this.getRarity()];
        }
        return round_item_price(this.value);
    } 
}

class Armor extends Equippable {
    /*
        equip slot is based on internal element (e.g. leather vest)
        external element can be empty

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
            this.components.external = item_data.components.external; //only the name
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
    }

    getDefense(quality) {
        if(!this.defense_value) {
            if(this.components) {
                this.defense_value = Math.ceil(((item_templates[this.components.internal].defense_value || 0) + 
                                           (item_templates[this.components.external]?.defense_value || 0 )) 
                                          * (quality || this.quality) * rarity_multipliers[quality || this.getRarity()]
                );
            } else {
                this.defense_value = Math.ceil(this.base_defense || 0)  * (quality || this.quality) * rarity_multipliers[quality || this.getRarity()]
            }
        }

        return this.defense_value;
    }

    getValue(quality) {
        if(!this.value) {
            //value of internal + value of external (if present), both multiplied by quality and rarity
            this.value = (item_templates[this.components.internal].value + 
                                   (item_templates[this.components.external]?.value || 0))
                                  * (quality || this.quality) * rarity_multipliers[quality || this.getRarity()];
        }
        return round_item_price(this.value);
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
    }

    getAttack(quality){
        if(!this.attack_power) {
            this.attack_power = Math.ceil(
                (item_templates[this.components.head].attack_value + item_templates[this.components.handle].attack_value)
                * item_templates[this.components.head].attack_multiplier * item_templates[this.components.handle].attack_multiplier
                * (quality || this.quality) * rarity_multipliers[quality || this.getRarity()]);

        }
        return this.attack_power;
    }

    getValue(quality) {
        if(!this.value) {
            //value of handle + value of head, both multiplied by quality and rarity
            this.value = (item_templates[this.components.handle].value + item_templates[this.components.head].value) * (quality || this.quality) * rarity_multipliers[quality || this.getRarity()]
        }
        return round_item_price(this.value);
    } 

    getName() {
        return `${item_templates[this.components.head].name_prefix} ${this.weapon_type === "hammer" ? "battle hammer" : this.weapon_type}`;
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
    }) {
        this.required_time = required_time;
        this.accumulated_time = 0;
        this.required_skills = required_skills;
        this.literacy_xp_rate = literacy_xp_rate;
        this.finish_reward = finish_reward;
        this.is_finished = false;
        this.rewards = rewards;
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
        if(book_stats[this.name].accumulated_time >= book_stats[this.name].required_time) {
            this.setAsFinished();
        }
    }

    setAsFinished() {
        book_stats[this.name].is_finished = true;
        book_stats[this.name].accumulated_time = book_stats[this.name].required_time;
        character.stats.add_book_bonus(book_stats[this.name].rewards);
    }
}

/**
 * @param {*} item_data 
 * @returns item of proper type, created with item_data
 */
function getItem(item_data) {
    switch(item_data.item_type) {
        case "EQUIPPABLE":
            switch(item_data.equip_slot) {
                case "weapon":
                    return new Weapon(item_data);
                case "off-hand":
                    return new Shield(item_data);
                case "artifact":
                    return new Artifact(item_data);
                default:
                    return new Armor(item_data);
            }
        case "USABLE":
            return new UsableItem(item_data);
        case "BOOK":
            return new Book(item_data);
        case "OTHER":
            return new OtherItem(item_data);
        case "COMPONENT":
            if(item_data.tags["weapon component"]) 
                return new WeaponComponent(item_data);
            else if(item_data.tags["armor component"]) 
                return new ArmorComponent(item_data);
            else if(item_data.tags["shield component"]) 
                return new ShieldComponent(item_data);
            else throw new Error(`Item ${item_data.name} has a wrong component type`);
        case "MATERIAL":
            return new Material(item_data);
        default:
            throw new Error(`Wrong item type: ${item_data.item_type}`);
    }
}

//book stats
book_stats["ABC for kids"] = new BookData({
    required_time: 120,
    literacy_xp_rate: 1,
    rewards: {
        xp_multipliers: {
            all: 1.1,
        }
    },
});

book_stats["Old combat manual"] = new BookData({
    required_time: 320,
    literacy_xp_rate: 1,
    rewards: {
        xp_multipliers: {
            Combat: 1.2,
        }
    },
});

book_stats["Twist liek a snek"] = new BookData({
    required_time: 320,
    literacy_xp_rate: 1,
    rewards: {
        xp_multipliers: {
            evasion: 1.2,
        }
    },
});

//books
item_templates["ABC for kids"] = new Book({
    name: "ABC for kids",
    description: "The simplest book on the market",
    value: 100,
});

item_templates["Old combat manual"] = new Book({
    name: "Old combat manual",
    description: "Old book about combat, worn and outdated, but might still contain something useful",
    value: 200,
});

item_templates["Twist liek a snek"] = new Book({
    name: "Twist liek a snek",
    description: "This book has a terrible grammar, seemingly written by some uneducated bandit, but despite that it quite well details how to properly evade attacks.",
    value: 200,
});


//miscellaneous and loot:
(function(){
    item_templates["Rat fang"] = new OtherItem({
        name: "Rat fang", 
        description: "Fang of a huge rat, not very sharp, but can still pierce a human skin if enough force is applied", 
        value: 8,
        saturates_market: true,
        price_recovers: true,
    });

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
    item_templates["Piece of rough wood"] = new Material({
        name: "Piece of rough wood", 
        description: "Not very strong, but easy to work with.", 
        value: 1,
        saturates_market: true,
        price_recovers: true,
        material_type: "piece of wood",
    });
    item_templates["Piece of wood"] = new Material({
        name: "Piece of wood", 
        description: "Average quality wood, useful for crafting thanks to flexible uses.", 
        value: 4,
        saturates_market: true,
        price_recovers: true,
        material_type: "piece of wood",
    });
    item_templates["Piece of ash wood"] = new Material({
        name: "Piece of ash wood", 
        description: "Strong yet elastic, it's a great crafting material.", 
        value: 7,
        saturates_market: true,
        price_recovers: true,
        material_type: "piece of wood",
    });

    item_templates["Belmart"] = new Material({
        name: "Belmart", 
        description: "Small, round, dark-green leaves with with very good disinfectant properties",
        value: 8,
        saturates_market: true,
        price_recovers: true,
        material_type: "disinfectant herb",
    });

    item_templates["Golmoon"] = new Material({
        name: "Golmoon", 
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

    item_templates["Wool"] = new Material({
        name: "Wool", 
        description: "A handfull of wool, raw and unprocessed",
        value: 8,
        saturates_market: true,
        price_recovers: true,
        material_type: "raw fabric",
    });
})();

//processed materials
(function(){
    item_templates["Low quality iron ingot"] = new Material({
        id: "Low quality iron ingot",
        name: "Low quality iron ingot", 
        description: "It has a lot of impurities, resulting in it being noticeably weaker than standard product.", 
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
    item_templates["Piece of wolf rat leather"] = new Material({
        name: "Piece of wolf rat leather",
        description: "It's slightly damaged and a bit too thin.",
        value: 4,
        saturates_market: true,
        price_recovers: true,
        material_type: "piece of leather",
    });
    item_templates["Piece of wolf leather"] = new Material({
        name: "Piece of wolf leather", 
        description: "Somewhat strong, should offer some protection when turned into armor",
        value: 8,
        saturates_market: true,
        price_recovers: true,
        material_type: "piece of leather",
    });
    item_templates["Wool cloth"] = new Material({
        name: "Piece of wolf leather", 
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
})();

//spare parts
(function(){
    item_templates["Basic spare parts"] = new ItemComponent({
        name: "Basic spare parts", description: "Some cheap and simple spare parts, like bindings and screws, necessary for crafting equipment",
        value: 30, 
        component_tier: 1,
    });
}());

//weapon components:
(function(){
    item_templates["Cheap short iron blade"] = new WeaponComponent({
        name: "Cheap short iron blade", description: "Crude blade made of iron. Perfect length for a dagger, but could be also used for a spear",
        component_type: "short blade",
        value: 90,
        component_tier: 1,
        name_prefix: "Cheap iron",
        attack_value: 5,
        stats: {
            crit_rate: {
                flat: 0.06,
            },
            attack_speed: {
                multiplier: 1.20,
            },
            agility: {
                flat: 1,
            }
        }
    });
    item_templates["Short iron blade"] = new WeaponComponent({
        name: "Short iron blade", description: "A good iron blade. Perfect length for a dagger, but could be also used for a spear",
        component_type: "short blade",
        value: 200,
        component_tier: 2,
        name_prefix: "Iron",
        attack_value: 8,
        stats: {
            crit_rate: {
                flat: 0.1,
            },
            attack_speed: {
                multiplier: 1.30,
            },
            agility: {
                flat: 2,
            }
        }
    });
    item_templates["Cheap long iron blade"] = new WeaponComponent({
        name: "Cheap long iron blade", description: "Crude blade made of iron, with a perfect length for a sword",
        component_type: "long blade",
        value: 120,
        name_prefix: "Cheap iron",
        component_tier: 1,
        attack_value: 8,
        stats: {
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
        value: 260,
        name_prefix: "Iron",
        component_tier: 2,
        attack_value: 13,
        stats: {
            attack_speed: {
                multiplier: 1.15,
            },
            crit_rate: {
                flat: 0.04,
            },
        }
    });
    item_templates["Cheap iron axe head"] = new WeaponComponent({
        name: "Cheap iron axe head", description: "A heavy axe head made of low quality iron",
        component_type: "axe head",
        value: 120,
        name_prefix: "Cheap iron",
        component_tier: 1,
        attack_value: 10,
        stats: {
            attack_speed: {
                multiplier: 0.9,
            }
        }
    });
    item_templates["Iron axe head"] = new WeaponComponent({
        name: "Iron axe head", description: "A heavy axe head made of good iron",
        component_type: "axe head",
        value: 260,
        name_prefix: "Iron",
        component_tier: 2,
        attack_value: 16,
        stats: {
            attack_speed: {
                multiplier: 0.95,
            }
        }
    });
    item_templates["Cheap iron hammer head"] = new WeaponComponent({
        name: "Cheap iron hammer head", description: "A crude ball made of low quality iron, with a small hole for the handle",
        component_type: "hammer head",
        value: 120,
        name_prefix: "Cheap iron",
        component_tier: 1,
        attack_value: 12,
        stats: {
            attack_speed: {
                multiplier: 0.8,
            }
        }
    });

    item_templates["Iron hammer head"] = new WeaponComponent({
        name: "Iron hammer head", description: "A crude ball made of iron, with a small hole for the handle",
        component_type: "hammer head",
        value: 260,
        name_prefix: "Iron",
        component_tier: 2,
        attack_value: 19,
        stats: {
            attack_speed: {
                multiplier: 0.85,
            }
        }
    });

    item_templates["Simple short wooden hilt"] = new WeaponComponent({
        name: "Simple short wooden hilt", description: "A short handle for a sword or maybe a dagger",
        component_type: "short handle",
        value: 50,
        component_tier: 1,
    });

    item_templates["Short wooden hilt"] = new WeaponComponent({
        name: "Short wooden hilt", description: "A short handle for a sword or maybe a dagger",
        component_type: "short handle",
        value: 75,
        component_tier: 2,
        stats: {
            attack_speed: {
                multiplier: 1.05,
            }
        }
    });

    item_templates["Simple medium wooden handle"] = new WeaponComponent({
        name: "Simple medium wooden handle", description: "A medium handle for an axe or a hammer",
        component_type: "medium handle",
        value: 60,
        component_tier: 1,
        stats: {
            attack_speed: {
                multiplier: 0.95,
            }
        }
    });

    item_templates["Medium wooden handle"] = new WeaponComponent({
        name: "Medium wooden handle", description: "A medium handle for an axe or a hammer",
        component_type: "medium handle",
        value: 90,
        component_tier: 2,
    });

    item_templates["Simple long wooden shaft"] = new WeaponComponent({
        name: "Simple long wooden shaft", description: "A long shaft for a spear, somewhat uneven",
        component_type: "long handle",
        value: 80,
        component_tier: 1,
        attack_multiplier: 1.5,
        stats: {
            attack_speed: {
                multiplier: 0.9,
            }
        }
    });

    item_templates["Long wooden shaft"] = new WeaponComponent({
        name: "Long wooden shaft", 
        description: "A long shaft for a spear, somewhat uneven",
        component_type: "long handle",
        value: 120,
        component_tier: 1,
        attack_multiplier: 1.5,
        stats: {
            attack_speed: {
                multiplier: 0.95,
            }
        }
    });

})();

//weapons:
(function(){
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
})();

//armor components:
(function(){
    item_templates["Wolf leather helmet armor"] = new ArmorComponent({
        name: "Wolf leather helmet armor", 
        description: "Strenghtened wolf leather, ready to be used as a part of a helmet",
        component_type: "helmet exterior",
        value: 300,
        component_tier: 2,
        full_armor_name: "Wolf leather helmet",
        defense_value: 2,
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
        value: 600,
        component_tier: 2,
        full_armor_name: "Wolf leather armor",
        defense_value: 4,
        stats: {
            attack_speed: {
                multiplier: 0.99,
            },
            agility: {
                multiplier: 0.95,
            }
        }
    });
    item_templates["Wolf leather greaves"] = new ArmorComponent({
        name: "Wolf leather greaves",
        description: "Greaves made of thick wolf leather. Just attach them onto some pants and you are ready to go.",
        component_type: "leg armor exterior",
        value: 300,
        component_tier: 2,
        full_armor_name: "Wolf leather leg armor",
        defense_value: 2,
        stats: {
            attack_speed: {
                multiplier: 0.99,
            },
            agility: {
                multiplier: 0.95,
            }
        }
    });
    item_templates["Wolf leather glove armor"] = new ArmorComponent({
        name: "Wolf leather glove armor",
        description: "Pieces of wolf leather shaped for gloves.",
        component_type: "glove exterior",
        value: 300,
        component_tier: 2,
        full_armor_name: "Wolf leather gloves",
        defense_value: 2,
        stats: {
            attack_speed: {
                multiplier: 0.99,
            },
        }
    });

    item_templates["Iron chainmail helmet"] = new ArmorComponent({
        name: "Iron chainmail helmet",
        description: "Best way to keep your head in one piece",
        component_type: "helmet exterior",
        value: 400,
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
        value: 800,
        component_tier: 2,
        full_armor_name: "Iron chainmail",
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
        value: 400,
        component_tier: 2,
        full_armor_name: "Iron chainmail leg armor",
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
        value: 400,
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
        value: 300,
        component_type: "chestplate interior",
        base_defense: 2,
        component_tier: 2,
        stats: {
            attack_speed: {
                multiplier: 0.99,
            },
        }
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
        value: 300,
        component_type: "leg armor interior",
        base_defense: 2,
        component_tier: 2,
        stats: {
            attack_speed: {
                multiplier: 0.99,
            },
        }
    });

    item_templates["Leather hat"] = new Armor({
        name: "Leather hat", 
        description: "A nice leather hat to protect your head.", 
        value: 300,
        component_type: "helmet interior",
        base_defense: 2,
        component_tier: 2,
        stats: {
            attack_speed: {
                multiplier: 0.99,
            },
        }
    });

    item_templates["Leather gloves"] = new Armor({
        name: "Leather gloves", 
        description: "Strong leather gloves, perfect for handling rough and sharp objects.", 
        value: 300,
        component_type: "glove interior",
        base_defense: 2,
        component_tier: 2,
        stats: {
            attack_speed: {
                multiplier: 0.99,
            },
            dexterity: {
                multiplier: 0.99,
            },
        }
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
        value: 300,
        component_type: "shoes interior",
        base_defense: 1,
        component_tier: 2,
        stats: {
            attack_speed: {
                multiplier: 1.01,
            },
            agility: {
                multiplier: 1.1,
            },
        }
    });

    item_templates["Wool shirt"] = new Armor({
        name: "Wool shirt",
        description: "It's thick enough to weaken a blow, but you shouldn't hope for much. On the plus side, it's light and doesn't block your moves.", 
        value: 300,
        component_type: "chestplate interior",
        base_defense: 1,
        component_tier: 2,
    });

    item_templates["Wool pants"] = new Armor({
        name: "Wool pants", 
        description: "Nice woollen pants. Slightly itchy.",
        value: 100,
        component_type: "leg armor interior",
        base_defense: 1,
        component_tier: 2,
    });

    item_templates["Wool hat"] = new Armor({
        name: "Wool hat", 
        description: "Simple woollen hat to protect your head.",
        value: 300,
        component_type: "helmet interior",
        base_defense: 1,
        component_tier: 2,
    });

    item_templates["Wool gloves"] = new Armor({
        name: "Wool gloves",
        description: "Warm and comfy, but they don't provide much protection.",
        value: 300,
        component_type: "glove interior",
        base_defense: 1,
        component_tier: 2,
    });

    item_templates["Wool gloves"] = new Armor({
        name: "Wool gloves",
        description: "Warm and comfy, but they don't provide much protection.",
        value: 300,
        component_type: "glove interior",
        base_defense: 1,
        component_tier: 2,
    });
})();

//armors:
(function(){
    //predefined full (int+ext) armors go here
})();

//shield components:
(function(){
    item_templates["Cheap wooden shield base"] = new ShieldComponent({
        name: "Cheap wooden shield base", description: "Cheap shield component made of wood, basically just a few planks barely holding together", 
        value: 100, 
        shield_strength: 2, 
        shield_name: "Cheap wooden shield",
        component_tier: 1,
        component_type: "shield base",
    });

    item_templates["Crude wooden shield base"] = new ShieldComponent({
        name: "Crude wooden shield base", description: "A shield component of rather bad quality, but at least it won't fall apart by itself", 
        value: 200,
        shield_strength: 4,
        shield_name: "Crude wooden shield",
        component_tier: 1,
        component_type: "shield base",
    });
    item_templates["Wooden shield base"] = new ShieldComponent({
        name: "Wooden shield base", description: "Proper wooden shield component, although it could use some additional reinforcement", 
        value: 400,
        shield_strength: 7,
        shield_name: "Wooden shield",
        component_tier: 1,
        component_type: "shield base",
    });
    item_templates["Basic shield handle"] = new ShieldComponent({
        name: "Wooden shield base", description: "A simple handle for holding the shield", 
        value: 80,
        component_tier: 1,
        component_type: "shield handle",
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
            handle: "Basic shield handle",
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
})();

//usables:
(function(){
    item_templates["Stale bread"] = new UsableItem({
        name: "Stale bread", description: "Big piece of an old bread, still edible", 
        value: 20,
        use_effect: {
            stamina_regeneration: {
                flat: 1,
                duration: 60,
            },
        }
    });

    item_templates["Fresh bread"] = new UsableItem({
        name: "Fresh bread", 
        description: "Freshly baked bread, delicious", 
        value: 40,
        use_effect: {
            stamina_regeneration: {
                flat: 1,
                duration: 120,
            },
        }
    });

    item_templates["Weak healing powder"] = new UsableItem({
        name: "Weak healing powder", 
        description: "Not very potent, but can still make body heal noticeably faster", 
        value: 50,
        use_effect: {
            health_regeneration: {
                flat: 1,
                duration: 120,
            },
        }
    });

    item_templates["Roasted rat meat"] = new UsableItem({
        name: "Roasted rat meat", 
        description: "Smell might be fine now, but it still seems like a bad idea to eat it",
        value: 20,
        use_effect: {
            stamina_regeneration: {
                flat: 2,
                duration: 30,
            },
            health_regeneration: {
                flat: -0.5,
                duration: 30,
            }
        }
    });
})();

export {
    item_templates, 
    Item, OtherItem, UsableItem, 
    Armor, Shield, Weapon, Artifact, Book, 
    WeaponComponent, ArmorComponent, ShieldComponent,
    getItem, setLootSoldCount, recoverItemPrices,
    book_stats, loot_sold_count
};