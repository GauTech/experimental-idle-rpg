"use strict";

import {item_templates, getItem} from "./items.js";
import {skills} from "./skills.js";
import {character} from "./character.js";
import { global_battle_state } from "./main.js";

let enemy_templates = {};
let enemy_killcount = {};
const rare_items_pool = ["TRUE ULTIMATE POWER","The Spellblade Chronicles vol. 1","Expert pickaxe","Expert axe","Expert sickle","Expert rod","Sparkling Treasure Chest"]; 
//enemy templates; locations create new enemies based on them


class Enemy {
    constructor({name, 
                 description, 
                 xp_value = 1, 
                 stats, 
                 rank,
                 loot_list = [], 
                 size = "small",
                 add_to_bestiary = true,
                 tags = {},
				 on_entry = {},
				 on_death = {},
				 on_strike = {},
				 on_connectedstrike = {},
				 custom_generate = {},
                }) {
                    
        this.name = name;
        this.rank = rank; //only for the bestiary order; higher rank => higher in display
        this.description = description; //try to keep it short
        this.xp_value = xp_value;
        this.stats = stats;
        //only magic & defense can be 0 in stats, other things will cause issues
        this.stats.max_health = stats.health;
        this.loot_list = loot_list;
        this.tags = {};
		this.on_entry = on_entry;
		this.on_death = on_death;
		/*
		Valid handling of on_entry and on_death effects
		    on_entry OR on_death: {
        bark: "msg", background message to play when invoked
        hero_damage: x, where x is armour bypassing damage
        flags: ["flag"], where flag is whatever flag to set.    },
		
		*/
		this.on_strike = on_strike; 
		/*
		Valid handling of on_strike
		on_strike: {multistrike: x}, where is used as a damage multiplier
		on_strike: {pierce: x}, where is used to pierce defence
		on_strike: {poison: x}, where is used for poison effect duration OR { poison: { duration: x, chance: y } } where x is duration and y is % chance of occuring (1=100%)
		on_strike: {burn: x}, where is used for burn effect duration OR { poison: { burn: x, chance: y } } where x is duration and y is % chance of occuring (1=100%)
		on_strike: {freeze: x}, where is used for freeze effect duration OR { poison: { freeze: x, chance: y } } where x is duration and y is % chance of occuring (1=100%)
		on_strike: {stun: x}, where is used for stun effect duration OR { stun: { duration: x, chance: y } } where x is duration and y is % chance of occuring (1=100%)
		on_strike: {flee: true}, causes the enemy to eject player from the combat encounter and generates a log message about escaping.
		on_strike: {bark: ["string1","string2","string3"]}, each on_strike invocation will play the next message in the barks list as a background message.
		*/
		this.on_connectedstrike = on_connectedstrike; 
		/*
		Valid handling of on_connectedstrike
		on_connectedstrike: {poison: x}, where is used for poison effect duration OR { poison: { duration: x, chance: y } } where x is duration and y is % chance of occuring (1=100%)
		on_connectedstrike: {burn: x}, where is used for burn effect duration OR { burn: { duration: x, chance: y } } where x is duration and y is % chance of occuring (1=100%)
		on_connectedstrike: {freeze: x}, where is used for freeze effect duration OR { freeze: { duration: x, chance: y } } where x is duration and y is % chance of occuring (1=100%)
		on_connectedstrike: {stun: x}, where is used for stun effect duration OR { stun: { duration: x, chance: y } } where x is duration and y is % chance of occuring (1=100%)
		on_connectedstrike: {flee: true}, causes the enemy to eject player from the combat encounter and generates a log message about escaping.
		on_connectedstrike: {bark: ["string1","string2","string3"]}, each on_connectedstrike invocation will play the next message in the barks list as a background message.
		
		NOTE: on_strike effects are called when the enemy attacks, on_connectedstrike effects are called when the attack successfully hits
		*/
		this.custom_generate = custom_generate;
        for(let i = 0; i <tags.length; i++) {
         this.tags[tags[i]] = true;
        }
        this.tags[size] = true;

        this.add_to_bestiary = add_to_bestiary; //generally set it false only for SOME of challenges and keep true for everything else

        if(size !== "small" && size !== "medium" && size !== "large") {
            throw new Error(`No such enemy size option as "size"!`);
        } else {
            this.size = size;
        }

    }
	
get_loot() {
    let loot = [];
    let item;

    // Normal loot
    for (let i = 0; i < this.loot_list.length; i++) {
        item = this.loot_list[i];
        if (!item_templates[item.item_name]) {
            console.warn(`Tried to loot an item "${item.item_name}" from "${this.name}", but such an item doesn't exist!`);
            continue;
        }

        if (item.chance * this.get_droprate_modifier() >= Math.random()) {
            let item_count = "count" in item ? item.count : 1;
            loot.push({ "item": getItem(item_templates[item.item_name]), "count": item_count });
        }
    }



    return loot;
}
	
	
	

    get_droprate_modifier() {
        let droprate_modifier = 1; 
		droprate_modifier *= skills["Salvaging"].get_coefficient("multiplicative");;
        /*
        if(enemy_killcount[this.name] >= 999) {
            droprate_modifier = 0.1;
        } else if(enemy_killcount[this.name]) {
            droprate_modifier = 111/(111+enemy_killcount[this.name]);
        }
        */
        return droprate_modifier;
    }
}






//regular enemies
(function(){

    enemy_templates["Starving wolf rat"] = new Enemy({
        name: "Starving wolf rat", 
        description: "Rat with size of a dog, starved and weakened", 
        xp_value: 1, 
        rank: 1,
        size: "small",
        tags: ["living", "beast", "wolf rat", "pest"],
        stats: {health: 20, attack: 5, agility: 6, dexterity: 4, magic: 0, intuition: 6, attack_speed: 0.8, defense: 1}, 
        loot_list: [
            {item_name: "Rat tail", chance: 0.04},
            {item_name: "Rat fang", chance: 0.04},
            {item_name: "Rat pelt", chance: 0.01}
        ]
    });

    enemy_templates["Wolf rat"] = new Enemy({
        name: "Wolf rat", 
        description: "Rat with size of a dog",
        xp_value: 1, 
        rank: 1,
        size: "small",
        tags: ["living", "beast", "wolf rat", "pest"],
        stats: {health: 30, attack: 7, agility: 8, dexterity: 6, intuition: 7, magic: 0, attack_speed: 1, defense: 2}, 
        loot_list: [
            {item_name: "Rat tail", chance: 0.04},
            {item_name: "Rat fang", chance: 0.04},
            {item_name: "Rat pelt", chance: 0.01},
        ]
    });
    enemy_templates["Elite wolf rat"] = new Enemy({
        name: "Elite wolf rat",
        description: "Rat with size of a dog, much more ferocious than its relatives",
        xp_value: 4, 
        rank: 1,
        size: "small",
        tags: ["living", "beast", "wolf rat", "pest"],
        stats: {health: 80, attack: 32, agility: 30, dexterity: 24, intuition: 24, magic: 0, attack_speed: 1.5, defense: 8}, 
        loot_list: [
            {item_name: "Rat tail", chance: 0.04},
            {item_name: "Rat fang", chance: 0.04},
            {item_name: "Rat pelt", chance: 0.02},
        ]
    });
    enemy_templates["Elite wolf rat guardian"] = new Enemy({
        name: "Elite wolf rat guardian",
        description: "It's no longer dog-sized, but rather around the size of an average wolf, with thicker skin, longer claws and pure insanity in the eyes",
        xp_value: 10, 
        rank: 4,
        size: "medium",
        tags: ["living", "beast", "wolf rat", "monster"],
        stats: {health: 250, attack: 50, agility: 40, dexterity: 40, intuition: 50, magic: 0, attack_speed: 1.2, defense: 30},
        loot_list: [
            {item_name: "Rat tail", chance: 0.04},
            {item_name: "Rat fang", chance: 0.04},
            {item_name: "Rat pelt", chance: 0.02},
            {item_name: "Weak monster bone", chance: 0.005},
        ]
    });



    enemy_templates["Wolf"] = new Enemy({
        name: "Wolf", 
        description: "A large, wild canine", 
        xp_value: 4, 
        rank: 3,
        tags: ["living", "beast"],
        stats: {health: 200, attack: 35, agility: 42, dexterity: 42, intuition: 32, magic: 0, attack_speed: 1.3, defense: 20}, 
        loot_list: [
            {item_name: "Wolf fang", chance: 0.04},
            {item_name: "Wolf pelt", chance: 0.02},
            {item_name: "High quality wolf fang", chance: 0.0005}
        ],
        size: "medium"
    });

    enemy_templates["Boar"] = new Enemy({
        name: "Boar", 
        description: "A large wild creature, with thick skin and large tusks", 
        xp_value: 8,
        rank: 4,
        tags: ["living", "beast"],
        stats: {health: 300, attack: 40, agility: 30, dexterity: 40, intuition: 40, magic: 0, attack_speed: 1, defense: 25},
        loot_list: [
            {item_name: "Boar hide", chance: 0.04},
            {item_name: "Boar meat", chance: 0.02},
            {item_name: "High quality boar tusk", chance: 0.0005},
        ],
        size: "medium"
    });
    
	
// test enemies
    enemy_templates["Pinata"] = new Enemy({
        name: "Pinata", 
        description: "Pinata",
        //xp_value: 10000, 
		xp_value: 1000000000000, 
        rank: 1,
        size: "medium",
        tags: ["undead", "animated", "fire", "spirit"],
        stats: {health: 1, attack: 1, agility: 1, dexterity: 1, intuition: 1, magic: 0, attack_speed: 1, defense: 1}, 
        loot_list: [
            //{item_name: "Bones", chance: 0.60},
			{item_name: "Low quality iron ore", chance: 1}, 
			{item_name: "Low quality iron ingot", chance: 1}, 
			{item_name: "Piece of wood", chance: 1}, 
			{item_name: "Piece of rough wood", chance: 1, count: 5}, 
			{item_name: "Wolf pelt", chance: 1, count: 5},
			{item_name: "Wool", chance: 1, count: 5},
			{item_name: "Boar hide", chance: 1, count: 5},
			{item_name: "Piece of mahogany wood", chance: 1, count: 5},
			{item_name: "Blacksteel ore", chance: 1, count: 5},
			{item_name: "Mithril ore", chance: 1, count: 5},
        ],
    });
	
    enemy_templates["OmniPinata"] = new Enemy({
        name: "OmniPinata", 
        description: "OmniPinata",
        //xp_value: 10000, 
		xp_value: 1000000000000, 
        rank: 1,
        size: "medium",
        tags: ["undead", "animated", "fire", "spirit", "ice", "beast", "abomination", "humanoid", "dragonoid", "arthropod", "amorphous"],
        stats: {health: 1, attack: 1, agility: 1, dexterity: 1, intuition: 1, magic: 0, attack_speed: 1, defense: 1}, 
        loot_list: [
            //{item_name: "Bones", chance: 0.60},
			{item_name: "Low quality iron ore", chance: 1}, {item_name: "Low quality iron ingot", chance: 1}, {item_name: "Piece of wood", chance: 1}, {item_name: "Piece of rough wood", chance: 1}, {item_name: "Iron ingot", chance: 1},
        ],
    });
	
	    enemy_templates["Speedy Pinata"] = new Enemy({
        name: "Speedy Pinata", 
        description: "Speedy Pinata",
        xp_value: 10000, 
		//xp_value: 1000000000000, 
        rank: 1,
        size: "medium",
        tags: ["undead", "animated", "fire", "spirit"],
        stats: {health: 1, attack: 1, agility: 1, dexterity: 50, intuition: 1, magic: 0, attack_speed: 30, defense: 1}, 
        loot_list: [
            //{item_name: "Bones", chance: 0.60},
			{item_name: "Low quality iron ore", chance: 1}, {item_name: "Low quality iron ingot", chance: 1}, {item_name: "Piece of wood", chance: 1}, {item_name: "Piece of rough wood", chance: 1}, {item_name: "Iron ingot", chance: 1},
        ],
    });

	    enemy_templates["Sturdy Pinata"] = new Enemy({
        name: "Sturdy Pinata", 
        description: "Sturdy Pinata",
        //xp_value: 10000, 
		xp_value: 100000000000000, 
        rank: 1,
        size: "medium",
        tags: ["undead", "animated", "fire", "spirit"],
        stats: {health: 1000, attack: 1, agility: 1, dexterity: 1, intuition: 1, magic: 0, attack_speed: 1, defense: 1}, 
        loot_list: [
            //{item_name: "Bones", chance: 0.60},
			{item_name: "Low quality iron ore", chance: 1}, {item_name: "Low quality iron ingot", chance: 1}, {item_name: "Piece of wood", chance: 1}, {item_name: "Piece of rough wood", chance: 1}, {item_name: "Iron ingot", chance: 1},
        ],
    });
	
/*base enemy rough guidelines
rank 1: =<20 total stats, 1 xp_value
rank 2: =<40 total stats, 5 xp_value
rank 3: =<80 total stats, 25 xp_value
rank 4: =<160 total stats, 125 xp_value
rank 5: =<320 total stats, 625 xp_value
rank 6: =<640 total stats, 3125 xp_value
rank 7: =<1280 total stats, 15625 xp_value
rank 8: =<2560 total stats, 78125 xp_value
rank 9: =<5120 total stats, 390625 xp_value


*/

//actual enemies

/*slime family Slimes have reduced stats vs equivalent rank and 0.6x xp scaling
Slime
Voluminous Slime
Acid Slime
Toxic Slime
Plasma Slime
Magma Slime
Platinum Slime
*/ 
    enemy_templates["Slime"] = new Enemy({
        name: "Slime", 
        description: "Puny and pathetic. It poses little threat even to novice adventurers.",
		xp_value: 1, 
        rank: 1,
        size: "small",
        tags: ["amorphous"],
        stats: {health: 20, attack: 2, agility: 2, dexterity: 1, magic: 0, intuition: 1, attack_speed: 0.8, defense: 0}, //stat_total = 20 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Goo", chance: 0.20},
        ],
    });
	
	    enemy_templates["Voluminous Slime"] = new Enemy({
        name: "Voluminous Slime", 
        description: "A massive, quivering blob that smothers prey in its suffocating bulk.",
		xp_value: 3, 
        rank: 2,
        size: "large",
        tags: ["amorphous"],
        stats: {health: 40, attack: 8, agility: 4, dexterity: 2, magic: 0, intuition: 2, attack_speed: 0.9, defense: 0}, 
        loot_list: [
            {item_name: "Goo", chance: 0.40},
        ],
    });
	
	    enemy_templates["Acid Slime"] = new Enemy({
        name: "Acid Slime", 
        description: "Its gel burns flesh and melts weapons. It can even seep through armour.",
		xp_value: 9, 
        rank: 3,
        size: "small",
        tags: ["amorphous"],
		on_strike: {pierce: 1},
        stats: {health: 40, attack: 28, agility: 4, dexterity: 22, magic: 0, intuition: 2, attack_speed: 1, defense: 0}, 
        loot_list: [
            {item_name: "Goo", chance: 0.80},
			{item_name: "Acid", chance: 0.80},
        ],
    });

	    enemy_templates["Toxic Slime"] = new Enemy({
        name: "Toxic Slime", 
        description: "A poison-filled menace that expels toxic fumes.",
		xp_value: 27, 
        rank: 4,
        size: "small",
        tags: ["amorphous"],
		on_strike: {poison: 20},
        stats: {health: 160, attack: 56, agility: 8, dexterity: 44, magic: 0, intuition: 8, attack_speed: 1.2, defense: 6}, 
        loot_list: [
            {item_name: "Goo", chance: 0.80, count: 2},
        ],
    });
	
	    enemy_templates["Plasma Slime"] = new Enemy({
        name: "Plasma Slime", 
        description: "Crackling with energy, it explodes in violent arcs of lightning.",
		xp_value: 81, 
        rank: 5,
        size: "small",
        tags: ["amorphous"],
        stats: {health: 320, attack: 100, agility: 20, dexterity: 70, magic: 0, intuition: 10, attack_speed: 1.3, defense: 12}, 
        loot_list: [
            {item_name: "Goo", chance: 1, count: 3},
        ],
    });

	    enemy_templates["Magma Slime"] = new Enemy({
        name: "Magma Slime", 
        description: "A ball of living magma. Scalding hot, and prone to explode when critically injured.",
		xp_value: 81, 
        rank: 6,
        size: "large",
        tags: ["amorphous", "fire"],
        stats: {health: 500, attack: 200, agility: 40, dexterity: 140, magic: 0, intuition: 20, attack_speed: 1.5, defense: 24}, 
        loot_list: [
            {item_name: "Burning Goo", chance: 1, count: 5},
        ],
		on_death: {hero_damage: 4,},
		on_strike: { burn: { duration: 100, chance: 0.4 } },
	});
	    enemy_templates["Platinum Slime"] = new Enemy({
        name: "Platinum Slime", 
        description: "The pinnacle of slimekind. Uses its dazzling speed to deftly avoid incoming attacks.",
		xp_value: 1000, 
        rank: 8,
        size: "small",
        tags: ["amorphous"],
		on_connectedstrike: {bark: ["zip","glop"], },
        stats: {health: 200, attack: 20, agility: 1000, dexterity: 140, magic: 0, intuition: 100, attack_speed: 3, defense: 20}, 
        loot_list: [
            {item_name: "Platinum Shard", chance: 1, count: 1},
        ],
    });
	
//spider family

enemy_templates["Giant Spider"] = new Enemy({
    name: "Giant Spider", 
    description: "A large and aggressive arachnid with powerful mandibles.",
	xp_value: 125, 
    rank: 4,
    size: "medium",
    tags: ["arthropod"],
    stats: {health: 100, attack: 40, agility: 22, dexterity: 30, magic: 0, intuition: 12, attack_speed: 1.1, defense: 4},
    loot_list: [
        {item_name: "Spider Silk", chance: 0.60},
        {item_name: "Spider Fang", chance: 0.30},
    ],
});

enemy_templates["Spider Ambusher"] = new Enemy({
    name: "Spider Ambusher", 
    description: "Lurks in shadows and leaps with precision.",
	xp_value: 125, 
    rank: 4,
    size: "small",
    tags: ["arthropod"],
	on_entry: {
		bark: { message: "Hiss!", chance: 0.5 },
		hero_damage: 2,
	},
    stats: {health: 70, attack: 38, agility: 34, dexterity: 36, magic: 0, intuition: 12, attack_speed: 1.3, defense: 3},
    loot_list: [
        {item_name: "Spider Silk", chance: 0.50},
        {item_name: "Chitin Shard", chance: 0.25},
    ],
});

enemy_templates["Venomous Spider"] = new Enemy({
    name: "Venomous Spider", 
    description: "Injects venom that paralyzes its prey.",
	xp_value: 125, 
    rank: 4,
    size: "small",
    tags: ["arthropod"],
    stats: {health: 60, attack: 50, agility: 20, dexterity: 36, magic: 0, intuition: 14, attack_speed: 1.4, defense: 4},
    loot_list: [
        {item_name: "Venom Gland", chance: 0.50},
        {item_name: "Spider Fang", chance: 0.40},
    ],
	on_connectedstrike: {poison: 200},
});

enemy_templates["Heavyweight Spider"] = new Enemy({
    name: "Heavyweight Spider", 
    description: "Thick armor and slow, powerful strikes.",
	xp_value: 125, 
    rank: 4,
    size: "medium",
    tags: ["arthropod"],
    stats: {health: 130, attack: 45, agility: 12, dexterity: 18, magic: 0, intuition: 6, attack_speed: 0.7, defense: 27},
    loot_list: [
        {item_name: "Chitin Plate", chance: 0.50},
        {item_name: "Spider Fang", chance: 0.20},
    ],
});

enemy_templates["Death-With-Legs"] = new Enemy({
    name: "Death-With-Legs", 
    description: "A viscous predator. Strikes with deadly precision.",
	xp_value: 625, 
    rank: 5,
    size: "large",
    tags: ["arthropod"],
	on_strike: {pierce: 5},
    stats: {health: 260, attack: 80, agility: 40, dexterity: 124, magic: 0, intuition: 16, attack_speed: 1.3, defense: 34},
    loot_list: [
        {item_name: "Venom Gland", chance: 0.60},
        {item_name: "Chitin Plate", chance: 0.40},
        {item_name: "Spider Core", chance: 0.25},
    ],
});

enemy_templates["Spider Queen"] = new Enemy({
    name: "Spider Queen", 
    description: "The terrifying matriarch of the spider brood.",
	xp_value: 3125, 
    rank: 6,
    size: "large",
    tags: ["arthropod"],
    stats: {health: 600, attack: 100, agility: 80, dexterity: 100, magic: 0, intuition: 60, attack_speed: 1.0, defense: 100},
    loot_list: [
        {item_name: "Spider Core", chance: 0.60},
        {item_name: "Royal Silk", chance: 0.40},
        {item_name: "Venom Gland", chance: 0.30},
		{item_name: "Shoddy Treasure Chest", chance: 0.30},
    ],
});
// ant family

enemy_templates["Giant Ant"] = new Enemy({
    name: "Giant Ant", 
    description: "An oversized ant with powerful mandibles.",
	xp_value: 25, 
    rank: 3,
    size: "small",
    tags: ["arthropod"],
    stats: {health: 60, attack: 14, agility: 10, dexterity: 12, magic: 0, intuition: 4, attack_speed: 1.2, defense: 4},
    loot_list: [
        {item_name: "Chitin Shard", chance: 0.20},
    ],
});

enemy_templates["Soldier Ant"] = new Enemy({
    name: "Soldier Ant", 
    description: "A disciplined ant bred for defense and warfare.",
	xp_value: 25, 
    rank: 3,
    size: "small",
    tags: ["arthropod"],
    stats: {health: 70, attack: 16, agility: 8, dexterity: 10, magic: 0, intuition: 4, attack_speed: 1.0, defense: 6},
    loot_list: [
        {item_name: "Chitin Shard", chance: 0.25},
        {item_name: "Ant Mandible", chance: 0.10},
    ],
});

enemy_templates["Fire Ant"] = new Enemy({
    name: "Fire Ant", 
    description: "Secretes a corrosive burning fluid as a defense.",
	xp_value: 25, 
    rank: 3,
    size: "small",
    tags: ["arthropod"],
    stats: {health: 50, attack: 18, agility: 12, dexterity: 10, magic: 0, intuition: 6, attack_speed: 1.4, defense: 2},
    loot_list: [
        {item_name: "Acid", chance: 0.20},
        {item_name: "Ant Mandible", chance: 0.15},
    ],
	on_death: {hero_damage: 1, },
});

enemy_templates["Legion Ant"] = new Enemy({
    name: "Legion Ant", 
    description: "Moves with military precision in tight formations.",
	xp_value: 25, 
    rank: 3,
    size: "small",
    tags: ["arthropod"],
    stats: {health: 60, attack: 14, agility: 10, dexterity: 12, magic: 0, intuition: 6, attack_speed: 1.1, defense: 6},
    loot_list: [
        {item_name: "Chitin Shard", chance: 0.25},
        {item_name: "Ant Mandible", chance: 0.10},
    ],
});

enemy_templates["Genetically Perfect Super Ant"] = new Enemy({
    name: "Genetically Perfect Super Ant", 
    description: "A flawless natural creation. Agile, deadly, and armored.",
	xp_value: 125, 
    rank: 4,
    size: "medium",
    tags: ["arthropod"],
    stats: {health: 100, attack: 36, agility: 26, dexterity: 30, magic: 0, intuition: 12, attack_speed: 1.3, defense: 6},
    loot_list: [
        {item_name: "Ant Core", chance: 0.25},
        {item_name: "Chitin Plate", chance: 0.20},
    ],
	on_death: {flags: ["is_rare_ant_killed"]},
});

enemy_templates["Ant Queen"] = new Enemy({
    name: "Ant Queen", 
    description: "The massive and commanding mother of the colony.",
	xp_value: 625, 
    rank: 5,
    size: "large",
    tags: ["arthropod"],
    stats: {health: 300, attack: 60, agility: 20, dexterity: 34, magic: 0, intuition: 26, attack_speed: 0.9, defense: 40},
    loot_list: [
        {item_name: "Royal Jelly", chance: 0.40},
        {item_name: "Ant Core", chance: 0.30},
        {item_name: "Chitin Plate", chance: 0.25},
		{item_name: "Shoddy Treasure Chest", chance: 0.20},
    ],
});

//bone tournament


    enemy_templates["Sir Bones"] = new Enemy({
        name: "Sir Bones", 
        description: "Sir Bones",
		add_to_bestiary: false,
		xp_value: 500, 
        rank: 4,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 240, attack: 60, agility: 15, dexterity: 56, magic: 0, intuition: 8, attack_speed: 1.2, defense: 5}, 
        loot_list: [
            {item_name: "Bones", chance: 1},
        ],
    });

    enemy_templates["Randall Lionheart Esquire (Deceased)"] = new Enemy({
        name: "Randall Lionheart Esquire (Deceased)", 
        description: "Randall Lionheart Esquire (Deceased)",
		add_to_bestiary: false,
		xp_value: 700, 
        rank: 4,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 180, attack: 70, agility: 25, dexterity: 66, magic: 0, intuition: 8, attack_speed: 1.3, defense: 12}, 
        loot_list: [
            {item_name: "Bones", chance: 1},
        ],
    });
	
    enemy_templates["Randall Lionheart Esquire Jnr (Deceased)"] = new Enemy({
        name: "Randall Lionheart Esquire Jnr (Deceased)", 
        description: "Randall Lionheart Esquire Jnr (Deceased)",
		add_to_bestiary: false,
		xp_value: 1000, 
        rank: 5,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 180, attack: 70, agility: 50, dexterity: 136, magic: 0, intuition: 8, attack_speed: 1.5, defense: 22}, 
        loot_list: [
            {item_name: "Bones", chance: 1},
        ],
    });
	
    enemy_templates["Skele-Tony"] = new Enemy({
        name: "Skele-Tony", 
        description: "Skele-Tony",
		add_to_bestiary: false,
		xp_value: 1500, 
        rank: 5,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 240, attack: 270, agility: 20, dexterity: 116, magic: 0, intuition: 8, attack_speed: 1.5, defense: 32}, 
        loot_list: [
            {item_name: "Bones", chance: 1},
        ],
    });	
	
    enemy_templates["Morbid Champion"] = new Enemy({
        name: "Morbid Champion", 
        description: "Morbid Champion",
		add_to_bestiary: false,
		xp_value: 2000, 
        rank: 5,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 340, attack: 270, agility: 40, dexterity: 136, magic: 5, intuition: 8, attack_speed: 1.3, defense: 52}, 
        loot_list: [
            {item_name: "Bones", chance: 1},
        ],
    });		
	
	    enemy_templates["The Bone Prince"] = new Enemy({
        name: "The Bone Prince", 
        description: "The Bone Prince",
		add_to_bestiary: false,
		xp_value: 2400, 
        rank: 6,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 440, attack: 370, agility: 140, dexterity: 236, magic: 1, intuition: 22, attack_speed: 1.3, defense: 42}, 
        loot_list: [
            {item_name: "Bones", chance: 1},
        ],
    });	

/// mimic
    enemy_templates["Mimic"] = new Enemy({
        name: "Mimic", 
        description: "A master of disguise that occasionally yields treasure. Very elusive.",
		xp_value: 50, 
        rank: 3,
        size: "medium",
        tags: ["beast"],
        stats: {health: 400, attack: 24, agility: 4, dexterity: 4, magic: 0, intuition: 2, attack_speed: 1, defense: 2}, 
        loot_list: [
            {item_name: "Shoddy Treasure Chest", chance: 0.20},
			{item_name: "Small Treasure Chest", chance: 0.05},
			{item_name: "Sparkling Treasure Chest", chance: 0.01},
			
        ],
    });

//rank 1s
    enemy_templates["Shambling Corpse"] = new Enemy({
        name: "Shambling Corpse", 
        description: "A slow and plodding zombie. Packs a decent punch if it hits. IF.",
		xp_value: 1, 
        rank: 1,
        size: "medium",
        tags: ["undead","humanoid"],
		on_connectedstrike: {bark: ["Grooooan","Braaains"], },
		on_death: {
		bark: { message: "The monster lets out a final shriek and falls silent!", chance: 0.5 },
},
        stats: {health: 20, attack: 12, agility: 2, dexterity: 2, magic: 0, intuition: 1, attack_speed: 0.8, defense: 1}, //stat_total = 20 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Rotten Flesh", chance: 0.20},
        ],
    });
	
    enemy_templates["Zombie Rat"] = new Enemy({
        name: "Zombie Rat", 
        description: "The perfect union of Zombie and Rat. Weak but annoying.",
		xp_value: 1, 
        rank: 1,
        size: "small",
        tags: ["undead","beast"],
        stats: {health: 10, attack: 6, agility: 5, dexterity: 5, magic: 0, intuition: 3, attack_speed: 0.9, defense: 0}, //stat_total = 20
        loot_list: [
            {item_name: "Rotten Flesh", chance: 0.20}, {item_name: "Rat fang", chance: 0.40}
        ],
    });
	
    enemy_templates["Bat"] = new Enemy({
        name: "Bat", 
        description: "Rats with wings.",
		xp_value: 1, 
        rank: 1,
        size: "small",
        tags: ["beast"],
        stats: {health: 6, attack: 4, agility: 9, dexterity: 5, magic: 0, intuition: 3, attack_speed: 1, defense: 0}, //stat_total = 18.6
        loot_list: [
            {item_name: "Bat Wings", chance: 0.20},
        ],
    });

    enemy_templates["Frail Zombie"] = new Enemy({
        name: "Frail Zombie", 
        description: "It could fall apart at any moment. Especially if it takes a hit or two.",
		xp_value: 1, 
        rank: 1,
        size: "medium",
        tags: ["beast", "undead"],
        stats: {health: 10, attack: 6, agility: 5, dexterity: 5, magic: 0, intuition: 2, attack_speed: 0.9, defense: 0}, //stat_total = 20
        loot_list: [
            {item_name: "Rotten Flesh", chance: 0.20},
        ],
    });
	


//rank 2s

    enemy_templates["Plague Rat"] = new Enemy({
        name: "Plague Rat", 
        description: "Scurrying little disease vectors.",
		xp_value: 5, 
        rank: 2,
        size: "small",
        tags: ["beast"],
		on_connectedstrike: { poison: { duration: 10, chance: 0.2 } }, 
        stats: {health: 30, attack: 3, agility: 11, dexterity: 11, magic: 0, intuition: 4, attack_speed: 0.9, defense: 1}, //stat_total = 40
        loot_list: [
            {item_name: "Rat meat chunks", chance: 0.10},
			{item_name: "Rat fang", chance: 0.40},
        ],
    });

    enemy_templates["Skeleton"] = new Enemy({
        name: "Skeleton", 
        description: "Basic undead. Bone variety.",
		xp_value: 5, 
        rank: 2,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 40, attack: 24, agility: 4, dexterity: 4, magic: 0, intuition: 2, attack_speed: 1, defense: 2}, //stat_total = 40 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Bones", chance: 0.40},
        ],
    });
	
    enemy_templates["Zombie"] = new Enemy({
        name: "Zombie", 
        description: "Run of the mill undead. Slow and clumsy, but still dangerous when massed.",
		xp_value: 5, 
        rank: 2,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 50, attack: 26, agility: 1, dexterity: 4, magic: 0, intuition: 2, attack_speed: 0.8, defense: 2}, //stat_total = 39 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Rotten Flesh", chance: 0.40},
        ],
    });

/// rank 2 boss
    enemy_templates["Royal Rat"] = new Enemy({
        name: "Royal Rat", 
        description: "The king of the sewers.",
		xp_value: 50, 
        rank: 2,
        size: "medium",
        tags: ["beast"],
		on_connectedstrike: { poison: { duration: 10, chance: 1 } }, 
        stats: {health: 300, attack: 3, agility: 11, dexterity: 11, magic: 0, intuition: 4, attack_speed: 1, defense: 1}, //stat_total = 40
        loot_list: [
            {item_name: "Rat meat chunks", chance: 0.10},
			{item_name: "Rat fang", chance: 0.40},
			{item_name: "Shoddy Treasure Chest", chance: 0.005}
        ],
    });


/// rank 3s
    enemy_templates["Skeleton Archer"] = new Enemy({
        name: "Skeleton Archer", 
        description: "A skeleton that specialises in ranged ambushes.",
		xp_value: 25, 
        rank: 3,
        size: "medium",
        tags: ["undead","humanoid"],
		on_entry: { hero_damage: 1,},
        stats: {health: 70, attack: 34, agility: 4, dexterity: 28, magic: 0, intuition: 4, attack_speed: 1.2, defense: 3}, //stat_total = 80 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Bones", chance: 0.60},
        ],
    });
	
    enemy_templates["Blighted One"] = new Enemy({
        name: "Blighted One", 
        description: "A cursed undead.",
		xp_value: 25, 
        rank: 3,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 120, attack: 30, agility: 10, dexterity: 18, magic: 0, intuition: 4, attack_speed: 0.8, defense: 6}, //stat_total = 80 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Rotten Flesh", chance: 0.60},
        ],
    });
	
    enemy_templates["Decrepit Construct"] = new Enemy({
        name: "Decrepit Construct", 
        description: "An abandoned rogue construct. Robust but clumsy.",
		xp_value: 25, 
        rank: 3,
        size: "large",
        tags: ["animated"],
        stats: {health: 250, attack: 29, agility: 1, dexterity: 20, magic: 0, intuition: 1, attack_speed: 0.8, defense: 4}, //stat_total = 80 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Magic Stone", chance: 0.2},
        ],
    });

    enemy_templates["Starving wolf"] = new Enemy({
        name: "Starving wolf", 
		description: "A large, wild and hungry canine", 
        xp_value: 25, 
        rank: 3,
        tags: ["living", "beast"],
        stats: {health: 150, attack: 20, agility: 27, dexterity: 27, intuition: 32, magic: 0, attack_speed: 1, defense: 12}, 
        loot_list: [
            {item_name: "Wolf fang", chance: 0.03},
            {item_name: "Wolf pelt", chance: 0.01},
        ],
        size: "medium",
    });

    enemy_templates["Young wolf"] = new Enemy({
        name: "Young wolf", 
        description: "A small, wild canine", 
        xp_value: 25, 
        rank: 3,
        tags: ["living", "beast"],
        stats: {health: 120, attack: 20, agility: 27, dexterity: 25, intuition: 24, magic: 0, attack_speed: 1.4, defense: 6}, 
        loot_list: [
            {item_name: "Wolf fang", chance: 0.03},
            {item_name: "Wolf pelt", chance: 0.01},
        ],
        size: "small",
    });

//// Rank 3 boss

    enemy_templates["Skeleton Warlord"] = new Enemy({
        name: "Skeleton Warlord", 
        description: "A skeleton that specialises in ranged ambushes.",
		xp_value: 50, 
        rank: 3,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 140, attack: 44, agility: 6, dexterity: 28, magic: 0, intuition: 6, attack_speed: 1.2, defense: 5}, //stat_total = 80 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Bones", chance: 0.60},
			{item_name: "Shoddy Treasure Chest", chance: 0.15},
        ],
    });


//The order
/*Bloody Knight
Famine Knight
Plague Knight
Silent Knight
Ash Knight
Storm Knight
Umbral Knight*/


    enemy_templates["Bloody Knight"] = new Enemy({
        name: "Bloody Knight", 
        description: "Undead knight. A knightly order braved the depths but all met gruesome ends.",
		xp_value: 80, 
        rank: 4.1,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 160, attack: 60, agility: 30, dexterity: 56, magic: 0, intuition: 8, attack_speed: 1.2, defense: 5}, // 1 stat x2
        loot_list: [
            {item_name: "Order Badge", chance: 1},
        ],
    });

    enemy_templates["Famine Knight"] = new Enemy({
        name: "Famine Knight", 
        description: "Undead knight. A knightly order braved the depths but all met gruesome ends.",
		xp_value: 80, 
        rank: 4.1,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 160, attack: 60, agility: 30, dexterity: 56, magic: 0, intuition: 8, attack_speed: 1.2, defense: 5}, //1 stat x2
        loot_list: [
            {item_name: "Order Badge", chance: 1},
        ],
    });

    enemy_templates["Plague Knight"] = new Enemy({
        name: "Plague Knight", 
        description: "Undead knight. A knightly order braved the depths but all met gruesome ends.",
		xp_value: 80, 
        rank: 4.1,
        size: "medium",
        tags: ["undead","humanoid"],
		on_connectedstrike: { poison: { duration: 20, chance: 0.5 } }, 
        stats: {health: 160, attack: 60, agility: 30, dexterity: 56, magic: 0, intuition: 8, attack_speed: 1.2, defense: 5}, //1 stat x2
        loot_list: [
            {item_name: "Order Badge", chance: 1},
        ],
    });
	
    enemy_templates["Frostbitten Knight"] = new Enemy({
        name: "Frostbitten Knight", 
        description: "Undead knight. A knightly order braved the depths but all met gruesome ends.",
		xp_value: 80, 
        rank: 4.1,
        size: "medium",
        tags: ["undead","humanoid"],
		on_connectedstrike: { freeze: { duration: 20, chance: 0.5 } }, 
        stats: {health: 160, attack: 60, agility: 15, dexterity: 112, magic: 0, intuition: 8, attack_speed: 1.2, defense: 5}, //1 stat x2
        loot_list: [
            {item_name: "Order Badge", chance: 1},
        ],
    });
	
    enemy_templates["Silent Knight"] = new Enemy({
        name: "Silent Knight", 
        description: "Undead knight. A knightly order braved the depths but all met gruesome ends.",
		xp_value: 80, 
        rank: 4.1,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 160, attack: 60, agility: 15, dexterity: 112, magic: 0, intuition: 8, attack_speed: 1.2, defense: 5}, //1 stat x2
        loot_list: [
            {item_name: "Order Badge", chance: 1},
        ],
    });
	
    enemy_templates["Ash Knight"] = new Enemy({
        name: "Ash Knight", 
        description: "Undead knight. A knightly order braved the depths but all met gruesome ends.",
		xp_value: 80, 
        rank: 4.1,
        size: "medium",
        tags: ["undead","humanoid"],
		on_connectedstrike: { burn: { duration: 20, chance: 0.5 } }, 
        stats: {health: 160, attack: 120, agility: 15, dexterity: 56, magic: 0, intuition: 8, attack_speed: 1.2, defense: 5}, //1 stat x2
        loot_list: [
            {item_name: "Order Badge", chance: 1},
			{item_name: "Castle Key", chance: 1},
        ],
    });
	
    enemy_templates["Storm Knight"] = new Enemy({
        name: "Storm Knight", 
        description: "Undead knight. A knightly order braved the depths but all met gruesome ends.",
		xp_value: 80, 
        rank: 4.1,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 160, attack: 120, agility: 15, dexterity: 56, magic: 0, intuition: 8, attack_speed: 1.2, defense: 5}, //1 stat x2
        loot_list: [
            {item_name: "Order Badge", chance: 1},
        ],
    });
	
    enemy_templates["Umbral Knight"] = new Enemy({
        name: "Umbral Knight", 
        description: "Undead knight. A knightly order braved the depths but all met gruesome ends.",
		xp_value: 80, 
        rank: 4.1,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 160, attack: 60, agility: 15, dexterity: 112, magic: 0, intuition: 8, attack_speed: 1.2, defense: 5}, //1 stat x2
        loot_list: [
            {item_name: "Order Badge", chance: 1},
        ],
    });

//rank 4s

    enemy_templates["Rogue Construct"] = new Enemy({
        name: "Rogue Construct", 
        description: "A haywire mining unit. Robust but clumsy.",
		xp_value: 125, 
        rank: 4,
        size: "large",
        tags: ["animated"],
        stats: {health: 500, attack: 50, agility: 1, dexterity: 30, magic: 0, intuition: 1, attack_speed: 0.8, defense: 20}, //stat_total = 80 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Magic Stone", chance: 0.4},
        ],
    });
    enemy_templates["Relay Drone"] = new Enemy({
        name: "Relay Drone", 
        description: "A transport automaton running amok.",
		xp_value: 125, 
        rank: 4,
        size: "medium",
        tags: ["animated"],
        stats: {health: 200, attack: 20, agility: 30, dexterity: 30, magic: 0, intuition: 1, attack_speed: 1.2, defense: 8}, //stat_total = 80 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Magic Stone", chance: 0.4},
        ],
    });	
    enemy_templates["Drone Foreman"] = new Enemy({
        name: "Drone Foreman", 
        description: "A commander unit among the mining drones.",
		xp_value: 125, 
        rank: 4,
        size: "large",
        tags: ["animated"],
        stats: {health: 1000, attack: 60, agility: 10, dexterity: 70, magic: 0, intuition: 1, attack_speed: 1, defense: 30}, //boss
        loot_list: [
            {item_name: "Magic Stone", chance: 0.4},
        ],
    });	


    enemy_templates["Skeleton Elite"] = new Enemy({
        name: "Skeleton Elite", 
        description: "Skeleton Elite",
		xp_value: 125, 
        rank: 4,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 160, attack: 60, agility: 15, dexterity: 56, magic: 0, intuition: 8, attack_speed: 1.2, defense: 5}, //stat_total = 160 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Bones", chance: 0.80},
			{item_name: "Elite skull", chance: 0.05},
        ],
    });
	
    enemy_templates["Ghoul"] = new Enemy({
        name: "Ghoul", 
        description: "Ghoul",
		xp_value: 125, 
        rank: 4,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 240, attack: 60, agility: 20, dexterity: 39, magic: 0, intuition: 8, attack_speed: 0.9, defense: 9}, //stat_total = 160 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Rotten Flesh", chance: 0.80},
        ],
    });
	
enemy_templates["Rot Worshipper"] = new Enemy({
    name: "Rot Worshipper", 
    description: "Deranged cultist that worships poison, blight and decay.",
	xp_value: 125, 
    rank: 4,
    size: "medium",
    tags: ["humanoid"],
    stats: {health: 120, attack: 50, agility: 20, dexterity: 46, magic: 0, intuition: 14, attack_speed: 1.4, defense: 4},
    loot_list: [
      
    ],
	on_connectedstrike: {poison: 20},
});
	
    enemy_templates["Spectre"] = new Enemy({
        name: "Spectre", 
        description: "Spectre",
		xp_value: 125, 
        rank: 4,
        size: "medium",
        tags: ["undead","spirit"],
        stats: {health: 100, attack: 50, agility: 50, dexterity: 30, magic: 10, intuition: 8, attack_speed: 1.4, defense: 2}, //stat_total = 160 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Ectoplasm", chance: 0.80},
        ],
    });
	
    enemy_templates["Feral Vampire"] = new Enemy({
        name: "Feral Vampire", 
        description: "Feral Vampire",
		xp_value: 125, 
        rank: 4,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 140, attack: 55, agility: 20, dexterity: 56, magic: 0, intuition: 11, attack_speed: 1.3, defense: 4}, //stat_total = 160 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Congealed Blood", chance: 1},
        ],
    });
	
    enemy_templates["Stone Golem"] = new Enemy({
        name: "Stone Golem", 
        description: "Stone Golem",
		xp_value: 125, 
        rank: 4,
        size: "large",
        tags: ["animated"],
        stats: {health: 500, attack: 58, agility: 1, dexterity: 42, magic: 0, intuition: 1, attack_speed: 0.8, defense: 8}, //stat_total = 160 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Magic Stone", chance: 0.4},
        ],
    });
//rank 5s

  enemy_templates["Wraith"] = new Enemy({
        name: "Wraith", 
        description: "Wraith",
		xp_value: 525, 
        rank: 5,
        size: "medium",
        tags: ["undead","spirit"],
        stats: {health: 200, attack: 100, agility: 100, dexterity: 60, magic: 20, intuition: 16, attack_speed: 1.6, defense: 4}, //stat_total = 320 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Ectoplasm", chance: 1},
        ],
    });
	
    enemy_templates["Skeleton Champion"] = new Enemy({
        name: "Skeleton Champion", 
        description: "Skeleton Champion",
		xp_value: 525, 
        rank: 5,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 320, attack: 110, agility: 40, dexterity: 112, magic: 0, intuition: 16, attack_speed: 1.4, defense: 10}, //stat_total = 320 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Bones", chance: 1},
        ],
    });

enemy_templates["Rot Warden"] = new Enemy({
    name: "Rot Warden", 
    description: "A more important member of the rot cult. It seems even anarchic cults have a hierachy.",
	xp_value: 525, 
    rank: 5,
    size: "medium",
    tags: ["humanoid"],
    stats: {health: 250, attack: 100, agility: 30, dexterity: 126, magic: 0, intuition: 16, attack_speed: 1.4, defense: 9},
    loot_list: [
      
    ],
	on_connectedstrike: {poison: 40},
});
	
    enemy_templates["Fledging Vampire"] = new Enemy({
        name: "Fledging Vampire", 
        description: "Fledging Vampire",
		xp_value: 525, 
        rank: 5,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 280, attack: 110, agility: 40, dexterity: 112, magic: 0, intuition: 22, attack_speed: 1.4, defense: 8}, //stat_total = 320 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Congealed Blood", chance: 1},
        ],
    });
	
    enemy_templates["Gargoyle"] = new Enemy({
        name: "Gargoyle", 
        description: "Gargoyle",
		xp_value: 525, 
        rank: 5,
        size: "large",
        tags: ["animated"],
        stats: {health: 880, attack: 116, agility: 11, dexterity: 84, magic: 0, intuition: 5, attack_speed: 1, defense: 16}, //stat_total = 160 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Magic Stone", chance: 0.6},
        ],
    });

    enemy_templates["Anti-Magic Golem"] = new Enemy({
        name: "Anti-Magic Golem", 
        description: "Anti-Magic Golem",
		xp_value: 1000, 
        rank: 5,
        size: "large",
        tags: ["animated"],
        stats: {health: 880, attack: 116, agility: 11, dexterity: 84, magic: 1000, intuition: 5, attack_speed: 1, defense: 16}, //stat_total = 160 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Magic Stone", chance: 0.6},
        ],
    });
	
//rank 6s

    enemy_templates["Dullahan"] = new Enemy({
        name: "Dullahan", 
        description: "Dullahan",
		xp_value: 2625, 
        rank: 6,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 640, attack: 220, agility: 80, dexterity: 224, magic: 0, intuition: 32, attack_speed: 1.5, defense: 20}, //stat_total = 640 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Bones", chance: 1},
        ],
    });

    enemy_templates["Undead Abomination"] = new Enemy({
        name: "Undead Abomination", 
        description: "Undead Abomination",
		xp_value: 2625, 
        rank: 6,
        size: "medium",
        tags: ["undead","abomination"],
        stats: {health: 1000, attack: 250, agility: 63, dexterity: 170, magic: 0, intuition: 32, attack_speed: 0.8, defense: 25}, //stat_total = 640 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Rotten Flesh", chance: 1},
        ],
    });

    enemy_templates["Bloodfiend"] = new Enemy({
        name: "Bloodfiend", 
        description: "Bloodfiend",
		xp_value: 2625, 
        rank: 6,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 560, attack: 220, agility: 80, dexterity: 224, magic: 0, intuition: 44, attack_speed: 1.8, defense: 16}, //stat_total = 640 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Congealed Blood", chance: 1},
        ],
    });
	
    enemy_templates["Lesser Chimera"] = new Enemy({
        name: "Lesser Chimera", 
        description: "Lesser Chimera",
		xp_value: 2625, 
        rank: 6,
        size: "large",
        tags: ["abomination", "beast"],
        stats: {health: 880, attack: 237, agility: 95, dexterity: 170, magic: 0, intuition: 30, attack_speed: 1.3, defense: 20}, //stat_total = 640 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Chimera Spine", chance: 0.6},
        ],
    });
    enemy_templates["Artificial Cerberus"] = new Enemy({
        name: "Artificial Cerberus", 
        description: "A monster stitched together from a trio of crazed wolves.",
		xp_value: 2625, 
        rank: 6,
        size: "large",
        tags: ["abomination", "beast"],
		on_strike: {multistrike: 3},
        stats: {health: 880, attack: 100, agility: 95, dexterity: 170, magic: 0, intuition: 30, attack_speed: 1.3, defense: 20}, //stat_total = 640 (discount atk speed, HP/10)
        loot_list: [
              {item_name: "Wolf fang", chance: 0.4, count: 3},
            {item_name: "Wolf pelt", chance: 0.5, count: 3},
            {item_name: "High quality wolf fang", chance: 0.1}
        ],
    });
	
	
    enemy_templates["Baby Wyvern"] = new Enemy({
        name: "Baby Wyvern", 
        description: "Baby Wyvern",
		xp_value: 2625, 
        rank: 6,
        size: "medium",
        tags: ["dragonoid"],
        stats: {health: 560, attack: 208, agility: 130, dexterity: 170, magic: 10, intuition: 56, attack_speed: 1.8, defense: 10}, //stat_total = 640 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Dragon Bone", chance: 0.2},
        ],
    });
//rank 7

    enemy_templates["Death Knight"] = new Enemy({
        name: "Death Knight", 
        description: "A powerful undead knight. A great champion in life and formidable foe in death.",
		xp_value: 13125, 
        rank: 7,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 1280, attack: 460, agility: 160, dexterity: 428, magic: 0, intuition: 64, attack_speed: 1.7, defense: 40}, //stat_total = 1280 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Bones", chance: 1},
        ],
    });

    enemy_templates["Bloodfiend"] = new Enemy({
        name: "Bloodfiend", 
        description: "Bloodfiend",
		xp_value: 13125, 
        rank: 7,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 1120, attack: 440, agility: 160, dexterity: 448, magic: 0, intuition: 88, attack_speed: 1.9, defense: 32}, //stat_total = 640 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Congealed Blood", chance: 1},
        ],
    });
    enemy_templates["Chimeric Chimera"] = new Enemy({
        name: "Chimeric Chimera", 
        description: "Chimeric Chimera",
		xp_value: 13125, 
        rank: 7,
        size: "large",
        tags: ["abomination", "beast"],
        stats: {health: 1760, attack: 484, agility: 190, dexterity: 340, magic: 0, intuition: 60, attack_speed: 1.8, defense: 30}, //stat_total = 1280 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Chimera Spine", chance: 0.8},
        ],
    });
	
/// rank 7 bosses

    enemy_templates["Exiled Demon"] = new Enemy({
        name: "Exiled Demon", 
        description: "Exiled Demon",
		xp_value: 40000, 
        rank: 7,
        size: "large",
        tags: ["fire"],
        stats: {health: 1120, attack: 880, agility: 160, dexterity: 448, magic: 0, intuition: 88, attack_speed: 2.1, defense: 32}, //stat_total = 640 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Demonic Essence", chance: 1},
        ],
    });



//rank 8s
    enemy_templates["Artificial Hydra"] = new Enemy({
        name: "Artificial Hydra", 
        description: "An 8-headed abomindation. ",
		xp_value: 65625, 
        rank: 8,
        size: "large",
        tags: ["abomination", "beast"],
		on_strike: {multistrike: 8},
        stats: {health: 3520, attack: 268, agility: 380, dexterity: 680, magic: 0, intuition: 120, attack_speed: 2.5, defense: 60}, //stat_total = 2560 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Regenerating Flesh", chance: 0.8},
			{item_name: "Sparkling Treasure Chest", chance: 0.5},
        ],
    });

    enemy_templates["Zombie Dragon"] = new Enemy({
        name: "Zombie Dragon", 
        description: "A reanimated dragon. Deprived of its intellect, but powerful nonetheless.",
		xp_value: 65625, 
        rank: 8,
        size: "large",
        tags: ["dragonoid", "undead"],
        stats: {health: 2240, attack: 932, agility: 520, dexterity: 680, magic: 40, intuition: 124, attack_speed: 2, defense: 40}, //stat_total = 2560 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Dragon Bone", chance: 0.6},
        ],
    });

//special
    enemy_templates["Time Demon"] = new Enemy({
        name: "Time Demon", 
        description: "A horror from beyond time and space. Its designs are unfathomable.",
		xp_value: 99999, 
        rank: 8,
        size: "large",
        tags: ["spirti"],
        stats: {health: 8888, attack: 777, agility: 666, dexterity: 555, magic: 444, intuition: 333, attack_speed: 2, defense: 40}, //stat_total = 2560 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Dragon Bone", chance: 0.6},
        ],
    });


//rank 8 boss

    enemy_templates["Saw Demon"] = new Enemy({
        name: "Saw Demon", 
        description: "Saw Demon",
		xp_value: 100000, 
        rank: 8,
        size: "large",
        tags: ["undead"],
        stats: {health: 8240, attack: 832, agility: 520, dexterity: 680, magic: 40, intuition: 224, attack_speed: 2, defense: 40}, //
        loot_list: [
            {item_name: "Demonic Essence", chance: 1},
        ],
    });
	
    enemy_templates["Chain Demon"] = new Enemy({
        name: "Chain Demon", 
        description: "Chain Demon",
		xp_value: 100000, 
        rank: 8,
        size: "large",
        tags: ["undead"],
        stats: {health: 8240, attack: 832, agility: 520, dexterity: 680, magic: 40, intuition: 224, attack_speed: 2, defense: 40}, //
        loot_list: [
            {item_name: "Demonic Essence", chance: 1},
        ],
    });

    enemy_templates["Chain-Saw Demon"] = new Enemy({
        name: "Chain-Saw Demon", 
        description: "Chain-Saw Demon",
		xp_value: 500000, 
        rank: 8,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 16240, attack: 1632, agility: 520, dexterity: 680, magic: 40, intuition: 224, attack_speed: 2, defense: 40}, //
        loot_list: [
            {item_name: "Demonic Essence", chance: 1},
        ],
    });


//rank 9
    enemy_templates["Black Dragon"] = new Enemy({
        name: "Black Dragon", 
        description: "A lesser dragon with an affinity with darkmess.",
		xp_value: 328125, 
        rank: 9,
        size: "large",
        tags: ["dragonoid"],
        stats: {health: 4480, attack: 1664, agility: 1030, dexterity: 1360, magic: 80, intuition: 448, attack_speed: 2.4, defense: 90}, //stat_total = 5120 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Dragon Bone", chance: 1},
        ],
    });
	    enemy_templates["Fire Dragon"] = new Enemy({
        name: "Fire Dragon", 
        description: "A lesser dragon with an affinity with fire.",
		xp_value: 328125, 
        rank: 9,
        size: "large",
        tags: ["dragonoid", "fire"],
		on_connectedstrike: { burn: { duration: 100, chance: 0.7 }},
        stats: {health: 4480, attack: 1704, agility: 1040, dexterity: 1340, magic: 80, intuition: 448, attack_speed: 2.4, defense: 60}, //stat_total = 5120 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Dragon Bone", chance: 1},
        ],
    });
    enemy_templates["Thunder Dragon"] = new Enemy({
        name: "Thunder Dragon", 
        description: "A lesser dragon with an affinity with thunder.",
		xp_value: 328125, 
        rank: 9,
        size: "large",
        tags: ["dragonoid"],
		on_connectedstrike: { stun: { duration: 10, chance: 0.7 }}, 
        stats: {health: 4480, attack: 1664, agility: 1040, dexterity: 1360, magic: 80, intuition: 448, attack_speed: 2.4, defense: 80}, //stat_total = 5120 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Dragon Bone", chance: 1},
        ],
    });
	    enemy_templates["Ice Dragon"] = new Enemy({
        name: "Ice Dragon", 
        description: "A lesser dragon with an affinity with ice.",
		xp_value: 328125, 
        rank: 9,
        size: "large",
        tags: ["dragonoid", "ice"],
		on_connectedstrike: { freeze: { duration: 100, chance: 0.7 }}, 
        stats: {health: 4480, attack: 1664, agility: 1040, dexterity: 1360, magic: 80, intuition: 448, attack_speed: 2.4, defense: 80}, //stat_total = 5120 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Dragon Bone", chance: 1},
        ],
    });
    enemy_templates["Earth Dragon"] = new Enemy({
        name: "Earth Dragon", 
        description: "A lesser dragon with an affinity with earth.",
		xp_value: 328125, 
        rank: 9,
        size: "large",
        tags: ["dragonoid"],
        stats: {health: 6480, attack: 1364, agility: 1080, dexterity: 1380, magic: 80, intuition: 448, attack_speed: 2.4, defense: 120}, //stat_total = 5120 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Dragon Bone", chance: 1},
        ],
    });
    enemy_templates["Sea Dragon"] = new Enemy({
        name: "Sea Dragon", 
        description: "A lesser dragon with an affinity with water.",
		xp_value: 328125, 
        rank: 9,
        size: "large",
        tags: ["dragonoid", "aquatic"],
        stats: {health: 4480, attack: 1364, agility: 1080, dexterity: 1580, magic: 80, intuition: 478, attack_speed: 2.4, defense: 90}, //stat_total = 5120 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Dragon Bone", chance: 1},
        ],
    });
	
//rank 9 bosses
    enemy_templates["Bloodstained Emperor"] = new Enemy({
        name: "Bloodstained Emperor", 
        description: "A fallen sovereign, presiding over an empire of dirt. Death is a mercy.",
		xp_value: 60000, 
        rank: 9,
        size: "large",
        tags: ["humanoid", "undead"],
        stats: {health: 4480, attack: 2564, agility: 130, dexterity: 1360, magic: 80, intuition: 448, attack_speed: 2.4, defense: 90}, //stat_total = 5120 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Imperial Regalia", chance: 1},
        ],
	 });


//rank 10
    enemy_templates["Eclipse Dragon"] = new Enemy({
        name: "Eclipse Dragon", 
        description: "An ancient and terrible dragon. Light itself shies away from it.",
		xp_value: 999999, 
        rank: 10,
        size: "large",
        tags: ["dragonoid", "true dragon"],
        stats: {health: 44800, attack: 1664, agility: 1030, dexterity: 1360, magic: 80, intuition: 448, attack_speed: 2.4, defense: 90}, //stat_total = 5120 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Dragon Bone", chance: 1},
			{item_name: "Dragon Heart", chance: 1},
        ],
    });
	    enemy_templates["Hellfire Dragon"] = new Enemy({
        name: "Hellfire Dragon", 
        description: "An ancient and terrible dragon. Its breath cam melt even the toughest steel.",
		xp_value: 999999, 
        rank: 10,
        size: "large",
        tags: ["dragonoid", "fire", "true dragon"],
		on_strike: {burn: 400},
        stats: {health: 44800, attack: 1704, agility: 1040, dexterity: 1340, magic: 80, intuition: 448, attack_speed: 2.4, defense: 60}, //stat_total = 5120 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Dragon Bone", chance: 1},
			{item_name: "Dragon Heart", chance: 1},
        ],
    });
    enemy_templates["Calamity Dragon"] = new Enemy({
        name: "Calamity Dragon", 
        description: "An ancient and terrible dragon. Wrecks devastation whereever it treads.",
		xp_value: 999999, 
        rank: 10,
        size: "large",
        tags: ["dragonoid", "true dragon"],
		
        stats: {health: 44800, attack: 1664, agility: 1040, dexterity: 1360, magic: 80, intuition: 448, attack_speed: 2.4, defense: 80}, //stat_total = 5120 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Dragon Bone", chance: 1},
			{item_name: "Dragon Heart", chance: 1},
        ],
    });
	    enemy_templates["Nightmare Dragon"] = new Enemy({
        name: "Nightmare Dragon", 
        description: "An ancient and terrible dragon. Its breath freezes to the bone.",
		xp_value: 999999, 
        rank: 10,
        size: "large",
        tags: ["dragonoid", "ice", "true dragon"],
		on_strike: {freeze: 400},
        stats: {health: 44800, attack: 1664, agility: 1040, dexterity: 1360, magic: 80, intuition: 448, attack_speed: 2.4, defense: 80}, //stat_total = 5120 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Dragon Bone", chance: 1},
			{item_name: "Dragon Heart", chance: 1}
        ],
    });
    enemy_templates["Primordial Dragon"] = new Enemy({
        name: "Primordial Dragon", 
        description: "An ancient and terrible dragon. It lived for centuries, and all expected it to live for centuries more.",
		xp_value: 999999, 
        rank: 10,
        size: "large",
        tags: ["dragonoid","true dragon"],
        stats: {health: 64800, attack: 1364, agility: 1080, dexterity: 1380, magic: 80, intuition: 448, attack_speed: 2.4, defense: 120}, //stat_total = 5120 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Dragon Bone", chance: 1},
			{item_name: "Dragon Heart", chance: 1},
        ],
    });	
	
////

    enemy_templates["Shadow"] = new Enemy({
        name: "Shadow", 
        description: "A perfect mirror of your power.",
		add_to_bestiary: false,
		xp_value: 100, 
        rank: 9,
        size: "medium",
        tags: ["humanoid", "spirit"],
		on_connectedstrike: { stun: { duration: 10, chance: 0.3 } }, 
        stats: {health: 1, attack: 1, agility: 1, dexterity: 1, magic: 1, intuition: 1, attack_speed: 1, defense: 1}, //stat_total = 5120 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Purest Darkness", chance: 1},
        ],
		    custom_generate: function (template, context) {
        const player_stats = character.stats.full;
		player_stats.attack = Math.round(character.stats.full.attack_power);
		player_stats.health = Math.round(character.stats.full.max_health);
        return {
            override_stats: { ...player_stats },
            post_generate(enemy) {
                // You can modify enemy behavior here if needed
            }
        };
    }
	 });

})();


    enemy_templates["Titan Turtle"] = new Enemy({
        name: "Titan Turtle", 
        description: "A great plodding beast. It would be dangerous if it had any inclination towards violence.", 
        xp_value: 30,
        rank: 5,
        tags: ["aquatic", "beast"],
        size: "large",
		on_strike: {flee: true},
        stats: {health: 100000, attack: 5, agility: 1, dexterity: 5, magic: 0, intuition: 50, attack_speed: 0.01, defense: 100},
		    custom_generate: function (template, context) {
        // Assume global_titan_turtle_state exists
        const saved_hp = global_battle_state["Titan Turtle"]?.hp ?? template.stats.health;
        return {
            override_stats: {
                ...template.stats,
				health: saved_hp,
			            },
            post_generate(enemy) {
                // Hook to allow saving current HP after combat ends
				enemy.stats.max_health = 100000;
                enemy.on_death = () => {
                    global_battle_state["Titan Turtle"] = { hp: 0 }; // dead
                };
                enemy.on_save_health = () => {
                global_battle_state["Titan Turtle"].hp = enemy.stats.health;
					};
            }
        };
    }
    });


//challenge enemies
(function(){
    enemy_templates["Village guard (heavy)"] = new Enemy({
        name: "Village guard (heavy)", 
        description: "", 
        add_to_bestiary: false,
        xp_value: 1,
        rank: 4,
        tags: ["living", "humanoid"],
        size: "medium",
        stats: {health: 300, attack: 50, agility: 20, dexterity: 80, magic: 0, intuition: 20, attack_speed: 0.2, defense: 30},
    });
    enemy_templates["Village guard (quick)"] = new Enemy({
        name: "Village guard (quick)", 
        description: "", 
        add_to_bestiary: false,
        xp_value: 1,
        rank: 4,
        tags: ["living", "humanoid"],
        size: "medium",
        stats: {health: 300, attack: 20, agility: 20, dexterity: 50, magic: 0, intuition: 20, attack_speed: 2, defense: 10},
    });
    enemy_templates["Suspicious wall"] = new Enemy({
        name: "Suspicious wall", 
        description: "", 
        add_to_bestiary: false,
        xp_value: 1,
        rank: 1,
        tags: ["animated"],
        size: "large",
        stats: {health: 10000, attack: 0, agility: 0, dexterity: 0, magic: 0, intuition: 0, attack_speed: 0.000001, defense: 100},
    });
    enemy_templates["Wall"] = new Enemy({
        name: "Wall", 
        description: "", 
        add_to_bestiary: false,
        xp_value: 1,
        rank: 1,
        tags: ["animated"],
        size: "large",
        stats: {health: 10000000, attack: 0, agility: 0, dexterity: 0, magic: 0, intuition: 0, attack_speed: 0.00001, defense: 1000},
    });
    enemy_templates["Suspicious man"] = new Enemy({
        name: "Suspicious man", 
        description: "", 
        add_to_bestiary: false,
        xp_value: 1,
        rank: 5,
        tags: ["living", "humanoid"],
        size: "medium",
        stats: {health: 400, attack: 60, agility: 60, dexterity: 60, magic: 0, intuition: 60, attack_speed: 2, defense: 30},
    });
})()

export {Enemy, enemy_templates, enemy_killcount, rare_items_pool};
