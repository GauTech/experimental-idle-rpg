"use strict";

import {item_templates, getItem} from "./items.js";

let enemy_templates = {};
let enemy_killcount = {};
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
                }) {
                    
        this.name = name;
        this.rank = rank; //only for the bestiary order; higher rank => higher in display
        this.description = description; //try to keep it short
        this.xp_value = xp_value;
        this.stats = stats;
        //only magic & defense can be 0 in stats, other things will cause issues
        this.stats.max_health = stats.health;
        this.loot_list = loot_list;
        this.tags = tags;
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
        // goes through items and calculates drops
        // result is in form [{item: Item, count: item_count}, {...}, {...}]
        let loot = [];
        let item;
        
        for (let i = 0; i < this.loot_list.length; i++) {
            item = this.loot_list[i];
            if(!item_templates[item.item_name]) {
                console.warn(`Tried to loot an item "${item.item_name}" from "${this.name}", but such an item doesn't exist!`);
                continue;
            }
            if (item.chance * this.get_droprate_modifier() >= Math.random()) {
                // checks if it should drop
                let item_count = 1;
                if ("count" in item) {
                    item_count = Math.round(Math.random() * (item["count"]["max"] - item["count"]["min"]) + item["count"]["min"]);
                    // calculates how much drops (from range min-max, both inclusive)
                }

                loot.push({ "item": getItem(item_templates[item.item_name]), "count": item_count });
            }
        }

        return loot;
    }
	
    get_loot() {
        // goes through items and calculates drops
        // result is in form [{item: Item, count: item_count}, {...}, {...}]
        let loot = [];
        let item;
        
        for (let i = 0; i < this.loot_list.length; i++) {
            item = this.loot_list[i];
            if(!item_templates[item.item_name]) {
                console.warn(`Tried to loot an item "${item.item_name}" from "${this.name}", but such an item doesn't exist!`);
                continue;
            }
            if (item.chance * this.get_droprate_modifier() >= Math.random()) {
                // checks if it should drop
                let item_count = 1;
                if ("count" in item) {
                    item_count = Math.round(Math.random() * (item["count"]["max"] - item["count"]["min"]) + item["count"]["min"]);
                    // calculates how much drops (from range min-max, both inclusive)
                }

                loot.push({ "item": getItem(item_templates[item.item_name]), "count": item_count });
            }
        }

        return loot;
    }
	
	

    get_droprate_modifier() {
        let droprate_modifier = 1;
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
    /*
    lore note:
    wolf rats are semi-magical creatures that feed on natural magical energy; cave near the village, where they live, is filled up with it on lower levels, 
    providing them with a perfect environment;
    rats on the surface are ones that were kicked out (because space is limited and they were weak), half starving and trying to quench their hunger by eating plants and stuff
    

    */
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

    enemy_templates["Starving wolf"] = new Enemy({
        name: "Starving wolf", description: "A large, wild and hungry canine", 
        xp_value: 3, 
        rank: 2,
        tags: ["living", "beast"],
        stats: {health: 150, attack: 25, agility: 34, dexterity: 34, intuition: 32, magic: 0, attack_speed: 1, defense: 12}, 
        loot_list: [
            {item_name: "Wolf fang", chance: 0.03},
            {item_name: "Wolf pelt", chance: 0.01},
        ],
        size: "medium",
    });

    enemy_templates["Young wolf"] = new Enemy({
        name: "Young wolf", 
        description: "A small, wild canine", 
        xp_value: 3, 
        rank: 2,
        tags: ["living", "beast"],
        stats: {health: 120, attack: 25, agility: 34, dexterity: 30, intuition: 24, magic: 0, attack_speed: 1.4, defense: 6}, 
        loot_list: [
            {item_name: "Wolf fang", chance: 0.03},
            {item_name: "Wolf pelt", chance: 0.01},
        ],
        size: "small",
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
			{item_name: "Low quality iron ore", chance: 1}, {item_name: "Low quality iron ingot", chance: 1}, {item_name: "Piece of wood", chance: 1}, {item_name: "Piece of rough wood", chance: 1}, {item_name: "Iron ingot", chance: 1},
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
//rank 1s
    enemy_templates["Shambling Corpse"] = new Enemy({
        name: "Shambling Corpse", 
        description: "Shambling Corpse",
		xp_value: 1, 
        rank: 1,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 20, attack: 12, agility: 2, dexterity: 2, magic: 0, intuition: 1, attack_speed: 0.8, defense: 1}, //stat_total = 20 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Rotten Flesh", chance: 0.20},
        ],
    });
	
    enemy_templates["Zombie Rat"] = new Enemy({
        name: "Zombie Rat", 
        description: "Zombie Rat",
		xp_value: 1, 
        rank: 1,
        size: "small",
        tags: ["undead","beast"],
        stats: {health: 10, attack: 6, agility: 5, dexterity: 5, magic: 0, intuition: 3, attack_speed: 0.9, defense: 0}, //stat_total = 20
        loot_list: [
            {item_name: "Rotten Flesh", chance: 0.20},
        ],
    });
	
    enemy_templates["Bat"] = new Enemy({
        name: "Bat", 
        description: "Bat",
		xp_value: 1, 
        rank: 1,
        size: "small",
        tags: ["beast"],
        stats: {health: 6, attack: 4, agility: 9, dexterity: 5, magic: 0, intuition: 3, attack_speed: 1, defense: 0}, //stat_total = 18.6
        loot_list: [
            {item_name: "Bat Wings", chance: 0.20},
        ],
    });

    enemy_templates["Zombie Rat"] = new Enemy({
        name: "Zombie Rat", 
        description: "Zombie Rat",
		xp_value: 1, 
        rank: 1,
        size: "small",
        tags: ["beast", "undead"],
        stats: {health: 10, attack: 6, agility: 5, dexterity: 5, magic: 0, intuition: 3, attack_speed: 0.9, defense: 0}, //stat_total = 20
        loot_list: [
            {item_name: "Rotten Flesh", chance: 0.20}, {item_name: "Rat fang", chance: 0.40}
        ],
    });
	
	    enemy_templates["Slime"] = new Enemy({
        name: "Slime", 
        description: "Slime",
		xp_value: 1, 
        rank: 1,
        size: "small",
        tags: ["amorphous"],
        stats: {health: 10, attack: 3, agility: 5, dexterity: 5, magic: 3, intuition: 3, attack_speed: 0.9, defense: 0}, //stat_total = 20
        loot_list: [
            {item_name: "Slime Jelly", chance: 0.20}
        ],
    });

//rank 2s

    enemy_templates["Plague Rat"] = new Enemy({
        name: "Plague Rat", 
        description: "Plague Rat",
		xp_value: 5, 
        rank: 2,
        size: "small",
        tags: ["beast"],
        stats: {health: 30, attack: 10, agility: 11, dexterity: 11, magic: 0, intuition: 4, attack_speed: 0.9, defense: 1}, //stat_total = 40
        loot_list: [
            {item_name: "Rat meat chunks", chance: 0.10},
			{item_name: "Rat fang", chance: 0.40}
        ],
    });

    enemy_templates["Skeleton"] = new Enemy({
        name: "Skeleton", 
        description: "Skeleton",
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
        description: "Zombie",
		xp_value: 5, 
        rank: 2,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 50, attack: 26, agility: 1, dexterity: 4, magic: 0, intuition: 2, attack_speed: 0.8, defense: 2}, //stat_total = 39 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Rotten Flesh", chance: 0.40},
        ],
    });

/// rank 3s
    enemy_templates["Skeleton Archer"] = new Enemy({
        name: "Skeleton Archer", 
        description: "Skeleton Archer",
		xp_value: 25, 
        rank: 3,
        size: "medium",
        tags: ["undead","humanoid"],
        stats: {health: 70, attack: 34, agility: 4, dexterity: 28, magic: 0, intuition: 4, attack_speed: 1.2, defense: 3}, //stat_total = 80 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Bones", chance: 0.60},
        ],
    });
	
    enemy_templates["Blighted One"] = new Enemy({
        name: "Blighted One", 
        description: "Blighted One",
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
        description: "Decrepit Construct",
		xp_value: 25, 
        rank: 3,
        size: "large",
        tags: ["animated"],
        stats: {health: 250, attack: 29, agility: 1, dexterity: 20, magic: 0, intuition: 1, attack_speed: 0.8, defense: 4}, //stat_total = 80 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Magic Stone", chance: 0.2},
        ],
    });

//rank 4s

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
        description: "Death Knight",
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



//rank 8s
    enemy_templates["Artificial Hydra"] = new Enemy({
        name: "Artificial Hydra", 
        description: "Artificial Hydra",
		xp_value: 65625, 
        rank: 8,
        size: "large",
        tags: ["abomination", "beast"],
        stats: {health: 3520, attack: 968, agility: 380, dexterity: 680, magic: 0, intuition: 120, attack_speed: 2.5, defense: 60}, //stat_total = 2560 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Regenerating Flesh", chance: 0.8},
        ],
    });

    enemy_templates["Zombie Dragon"] = new Enemy({
        name: "Zombie Dragon", 
        description: "Zombie Dragon",
		xp_value: 65625, 
        rank: 8,
        size: "large",
        tags: ["dragonoid", "undead"],
        stats: {health: 2240, attack: 832, agility: 520, dexterity: 680, magic: 40, intuition: 224, attack_speed: 2, defense: 40}, //stat_total = 2560 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Dragon Bone", chance: 0.6},
        ],
    });

//rank 9s
    enemy_templates["Black Dragon"] = new Enemy({
        name: "Black Dragon", 
        description: "Black Dragon",
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
        description: "Fire Dragon",
		xp_value: 328125, 
        rank: 9,
        size: "large",
        tags: ["dragonoid", "fire"],
        stats: {health: 4480, attack: 1704, agility: 1040, dexterity: 1340, magic: 80, intuition: 448, attack_speed: 2.4, defense: 60}, //stat_total = 5120 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Dragon Bone", chance: 1},
        ],
    });
    enemy_templates["Thunder Dragon"] = new Enemy({
        name: "Thunder Dragon", 
        description: "Thunder Dragon",
		xp_value: 328125, 
        rank: 9,
        size: "large",
        tags: ["dragonoid"],
        stats: {health: 4480, attack: 1664, agility: 1040, dexterity: 1360, magic: 80, intuition: 448, attack_speed: 2.4, defense: 80}, //stat_total = 5120 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Dragon Bone", chance: 1},
        ],
    });
	    enemy_templates["Ice Dragon"] = new Enemy({
        name: "Ice Dragon", 
        description: "Ice Dragon",
		xp_value: 328125, 
        rank: 9,
        size: "large",
        tags: ["dragonoid", "ice"],
        stats: {health: 4480, attack: 1664, agility: 1040, dexterity: 1360, magic: 80, intuition: 448, attack_speed: 2.4, defense: 80}, //stat_total = 5120 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Dragon Bone", chance: 1},
        ],
    });
    enemy_templates["Earth Dragon"] = new Enemy({
        name: "Earth Dragon", 
        description: "Earth Dragon",
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
        description: "Sea Dragon",
		xp_value: 328125, 
        rank: 9,
        size: "large",
        tags: ["dragonoid"],
        stats: {health: 4480, attack: 1364, agility: 1080, dexterity: 1580, magic: 80, intuition: 478, attack_speed: 2.4, defense: 90}, //stat_total = 5120 (discount atk speed, HP/10)
        loot_list: [
            {item_name: "Dragon Bone", chance: 1},
        ],
    });
})();




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

export {Enemy, enemy_templates, enemy_killcount};
