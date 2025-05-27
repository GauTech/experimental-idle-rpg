"use strict";

import {item_templates, getItem} from "./items.js";
import {skills} from "./skills.js";
import {character} from "./character.js";

const allies = {};
//allies are just untargettable damage platforms for now


class Ally {
    constructor({name, 
				ally_id,
                description,  
                stats, 
				attack_power = 1,
				attack_speed = 1,
				AP = 100,
				target_count = 1,
				damage_type,
				ally_bonus = {},

                }) {
                    
        this.name = name;
		this.ally_id = ally_id;
        this.description = description; //try to keep it short
        this.attack_power = attack_power;
        this.attack_speed = attack_speed;
		this.AP = AP;
		this.target_count = target_count;
		this.damage_type = damage_type;
		this.ally_bonus = ally_bonus;

    }
}


    allies["slayer"] = new Ally({
        name: "Slayer",
		ally_id: "slayer",
        description: "A fearless veteran who bathes in the blood of his enemies.", //try to keep it short
        attack_power: 120,
        attack_speed: 1.2,
		AP: 300,
		target_count: 2,
    });
	
    allies["captain"] = new Ally({
        name: "Captain",
		ally_id: "captain",
        description: "Captain", //try to keep it short
        attack_power: 70,
        attack_speed: 1.2,
		AP: 300,
		target_count: 2,
    });
	
    allies["knight"] = new Ally({
        name: "Knight",
		ally_id: "knight",
        description: "Knight", //try to keep it short
        attack_power: 70,
        attack_speed: 1.2,
		AP: 300,
		target_count: 2,
    });
    allies["scholar"] = new Ally({
        name: "Scholar",
		ally_id: "scholar",
        description: "Scholar", //try to keep it short
        attack_power: 70,
        attack_speed: 1.2,
		AP: 300,
		target_count: 2,
    });
	
    allies["skeleton1"] = new Ally({
        name: "Skeleton",
		ally_id: "skeleton1",
        description: "Skeleton", //try to keep it short
        attack_power: 60,
        attack_speed: 1.2,
		AP: 180,
		target_count: 1,
    });	
	
export {
    allies,};