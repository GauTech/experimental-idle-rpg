"use strict";

import { enemy_templates, Enemy } from "./enemies.js";
import { dialogues as dialoguesList} from "./dialogues.js";
import { skills } from "./skills.js";
import { current_game_time } from "./game_time.js";
import { activities } from "./activities.js";
const locations = {};
const location_types = {};
//contains all the created locations

class Location {
    constructor({
                name, 
                id,
                description, 
                connected_locations, 
                is_unlocked = true, 
                is_finished = false,
                dialogues = [], 
                traders = [],
                types = [], //{type, xp per tick}
                sleeping = null, //{text to start, xp per tick},
                light_level = "normal",
                getDescription,
                background_noises = [],
                getBackgroundNoises,
                crafting = null,
                tags = {},
            }) {
        // always a safe zone

        this.name = name; //needs to be the same as key in locations
        this.id = id || name;
        this.description = description;
        this.getDescription = getDescription || function(){return description;}
        this.background_noises = background_noises;
        this.getBackgroundNoises = getBackgroundNoises || function(){return background_noises;}
        this.connected_locations = connected_locations; //a list
        this.is_unlocked = is_unlocked;
        this.is_finished = is_finished; //for when it's in any way or form "completed" and player shouldn't be allowed back
        this.dialogues = dialogues;
        this.traders = traders;
        this.activities = {};
        this.types = types;
        this.sleeping = sleeping;
        for (let i = 0; i < this.dialogues.length; i++) {
            if (!dialoguesList[this.dialogues[i]]) {
                throw new Error(`No such dialogue as "${this.dialogues[i]}"!`);
            }
        }
        this.light_level = light_level; //not really used for this type
        this.crafting = crafting;
        this.tags = tags;
        this.tags["Safe zone"] = true;
        /* 
        crafting: {
            is_unlocked: Boolean, 
            use_text: String, 
            tiers: {
                crafting: Number,
                forging: Number,
                smelting: Number,
                cooking: Number,
                alchemy: Number,
            }
        },
         */
    }
}

class Combat_zone {
    constructor({name, 
                id,
                 description, 
                 getDescription,
                 is_unlocked = true, 
                 is_finished = false,
                 types = [], //{type, xp_gain}
                 enemy_groups_list = [],
                 enemies_list = [], 
                 enemy_group_size = [1,1],
                 enemy_count = 30,
                 enemy_stat_variation = 0,
                 parent_location, 
                 leave_text,
                 first_reward = {},
                 repeatable_reward = {},
                 otherUnlocks,
                 unlock_text,
                 is_challenge = false,
                 tags = {},
                }) {

        this.name = name;
        this.id = id || name;
        this.unlock_text = unlock_text;
        this.description = description;
        this.getDescription = getDescription || function(){return description;}
        this.otherUnlocks = otherUnlocks || function() {return;}
        this.is_unlocked = is_unlocked;
        this.is_finished = is_finished;
        this.types = types; //special properties of the location, e.g. "narrow" or "dark"
        this.enemy_groups_list = enemy_groups_list; //predefined enemy teams, names only
        this.enemies_list = enemies_list; //possible enemies (to be used if there's no enemy_groups_list), names only
        this.enemy_group_size = enemy_group_size; // [min, max], used only if enemy_groups_list is not provided
        if(!this.enemy_groups_list){
            if(this.enemy_group_size[0] < 1) {
                this.enemy_group_size[0] = 1;
                console.error(`Minimum enemy group size in zone "${this.name}" is set to unallowed value of ${this.enemy_group_size[0]} and was corrected to lowest value possible of 1`);
            }
            if(this.enemy_group_size[0] > 8) {
                this.enemy_group_size[0] = 8;
                console.error(`Minimum enemy group size in zone "${this.name}" is set to unallowed value of ${this.enemy_group_size[0]} and was corrected to highest value possible of 8`);
            }
            if(this.enemy_group_size[1] < 1) {
                this.enemy_group_size[1] = 1;
                console.error(`Maximum enemy group size in zone "${this.name}" is set to unallowed value of ${this.enemy_group_size[1]} and was corrected to lowest value possible of 1`);
            }
            if(this.enemy_group_size[1] > 8) {
                this.enemy_group_size[1] = 8;
                console.error(`Maximum enemy group size in zone "${this.name}" is set to unallowed value of ${this.enemy_group_size[1]} and was corrected to highest value possible of 8`);
            }
        }
        this.enemy_count = enemy_count; //how many enemy groups need to be killed for the clearing reward

        if(this.enemy_groups_list.length == 0 && this.enemies_list.length == 0 ) {
            throw new Error(`No enemies provided for zone "${this.name}"`);
        }

        this.enemy_groups_killed = 0; //killcount for clearing

        this.enemy_stat_variation = enemy_stat_variation; // e.g. 0.1 means each stat can go 10% up/down from base value; random for each enemy in group
        if(this.enemy_stat_variation < 0) {
            this.enemy_stat_variation = 0;
            console.error(`Stat variation for enemies in zone "${this.name}" is set to unallowed value and was corrected to a default 0`);
        }

        this.parent_location = parent_location;
        if(!locations[this.parent_location.name]) {
            throw new Error(`Couldn't add parent location "${this.parent_location.name}" to zone "${this.name}"`)
        }

        this.leave_text = leave_text; //text on option to leave
        this.first_reward = first_reward; //reward for first clear
        this.repeatable_reward = repeatable_reward; //reward for each clear, including first; all unlocks should be in this, just in case

        this.is_challenge = is_challenge;
        //challenges can be completed only once 

        //skills and their xp gain on every tick, based on location types;
        this.gained_skills = this.types
            ?.map(type => {return {skill: skills[location_types[type.type].stages[type.stage || 1].related_skill], xp: type.xp_gain}})
            .filter(skill => skill.skill);
       
        const temp_types = this.types.map(type => type.type);
        if(temp_types.includes("bright")) {
            this.light_level = "bright";
        }
        else if(temp_types.includes("dark")) {
            this.light_level = "dark";
        } else {
            this.light_level = "normal";
        }

        this.tags = tags;
        this.tags["Combat zone"] = true;
    }

    get_next_enemies() {

        const enemies = [];
        let enemy_group = [];

        if(this.enemy_groups_list.length > 0) { // PREDEFINED GROUPS EXIST

            const index = Math.floor(Math.random() * this.enemy_groups_list.length);
            enemy_group = this.enemy_groups_list[index]; //names

        } else {  // PREDEFINED GROUPS DON'T EXIST

            const group_size = this.enemy_group_size[0] + Math.floor(Math.random() * (this.enemy_group_size[1] - this.enemy_group_size[0]));
            for(let i = 0; i < group_size; i++) {
                enemy_group.push(this.enemies_list[Math.floor(Math.random() * this.enemies_list.length)]);
            }
        }
 
        for(let i = 0; i < enemy_group.length; i++) {
            const enemy = enemy_templates[enemy_group[i]];
            let newEnemy;
            if(this.enemy_stat_variation != 0) {

                const variation = Math.random() * this.enemy_stat_variation;

                const base = 1 + variation;
                const vary = 2 * variation;
                newEnemy = new Enemy({
                                        name: enemy.name, 
                                        description: enemy.description, 
                                        xp_value: enemy.xp_value,
                                        stats: {
                                            health: Math.round(enemy.stats.health * (base - Math.random() * vary)),
                                            attack: Math.round(enemy.stats.attack * (base - Math.random() * vary)),
                                            agility: Math.round(enemy.stats.agility * (base - Math.random() * vary)),
                                            dexterity: Math.round(enemy.stats.dexterity * (base - Math.random() * vary)),
                                            magic: Math.round(enemy.stats.magic * (base - Math.random() * vary)),
                                            intuition: Math.round(enemy.stats.intuition * (base - Math.random() * vary)),
                                            attack_speed: Math.round(enemy.stats.attack_speed * (base - Math.random() * vary) * 100) / 100,
                                            defense: Math.round(enemy.stats.defense * (base - Math.random() * vary))
                                        },
										tags: enemy.tags,
                                        loot_list: enemy.loot_list,
                                        add_to_bestiary: enemy.add_to_bestiary,
                                        size: enemy.size,
                                    });

            } else {
                newEnemy = new Enemy({name: enemy.name, 
                    description: enemy.description, 
                    xp_value: enemy.xp_value,
                    stats: {
                        health: enemy.stats.health,
						health: enemy.stats.max_health,
                        attack: enemy.stats.attack,
                        agility: enemy.stats.agility,
                        dexterity: enemy.stats.dexterity,
                        magic: enemy.stats.magic,
                        intuition: enemy.stats.intuition,
                        attack_speed: enemy.stats.attack_speed,
                        defense: enemy.stats.defense
                    },
                    loot_list: enemy.loot_list,
                    add_to_bestiary: enemy.add_to_bestiary,
                    size: enemy.size
                });
            }
            newEnemy.is_alive = true;
            enemies.push(newEnemy); 
        }
        return enemies;
    }

    //calculates total penalty with and without hero skills
    //launches on every combat action
    get_total_effect() {
        const effects = {multipliers: {}};
        const hero_effects = {multipliers: {}};
        
        //iterate over types of location
        for(let i = 0; i < this.types.length; i++) {
            const type = location_types[this.types[i].type].stages[this.types[i].stage];

            if(!type.related_skill || !type.effects) { 
                continue; 
            }

            //iterate over effects each type has 
            //(ok there's really just only 3 that make sense: attack points, evasion points, strength, though maybe also attack speed? mainly the first 2 anyway)
            Object.keys(type.effects.multipliers).forEach((effect) => { 

                effects.multipliers[effect] = (effects.multipliers[effect] || 1) * type.effects.multipliers[effect];
                
                hero_effects.multipliers[effect] = (hero_effects.multipliers[effect] || 1) * get_location_type_penalty(this.types[i].type, this.types[i].stage, effect);
            })
        }

        

        return {base_penalty: effects, hero_penalty: hero_effects};
    }
}

class Challenge_zone extends Combat_zone {
    constructor({name, 
        description, 
        getDescription,
        is_unlocked = true, 
        types = [], //{type, xp_gain}
        enemy_groups_list = [],
        enemies_list = [], 
        enemy_group_size = [1,1],
        enemy_count = 30,
        parent_location, 
        leave_text,
        first_reward = {},
        repeatable_reward = {},
        otherUnlocks,
        is_finished,
        unlock_text,
       }) 
    {
        super(
            {   
                name, 
                description, 
                getDescription, 
                is_unlocked, 
                types, 
                enemy_groups_list, 
                enemies_list, 
                enemy_group_size, 
                enemy_count, 
                enemy_stat_variation: 0, 
                parent_location,
                leave_text,
                first_reward,
                repeatable_reward,
                is_challenge: true,
                otherUnlocks,
                is_finished,
                unlock_text,
            }
        )
    }
}

class LocationActivity{
    constructor({activity_name, 
                 starting_text, 
                 get_payment = ()=>{return 1},
                 is_unlocked = true, 
                 working_period = 60,
                 infinite = false,
                 availability_time,
                 skill_xp_per_tick = 1,
                 unlock_text,
                 gained_resources,
                 require_tool = true,
                 }) 
    {
        this.activity_name = activity_name; //name of activity from activities.js
        this.starting_text = starting_text; //text displayed on button to start action

        this.get_payment = get_payment;
        this.is_unlocked = is_unlocked;
        this.unlock_text = unlock_text;
        this.working_period = working_period; //if exists -> time that needs to be worked to earn anything; only for jobs
        this.infinite = infinite; //if true -> can be done 24/7, otherwise requires availability time
        if(this.infinite && availability_time) {
            console.error("Activity is set to be available all the time, so availability_time value will be ignored!");
        }
        if(!this.infinite && !availability_time) {
            throw new Error("LocationActivities that are not infinitely available, require a specified time of availability!");
        }
        this.availability_time = availability_time; //if not infinite -> hours between which it's available
        
        this.skill_xp_per_tick = skill_xp_per_tick; //skill xp gained per game tick (default -> 1 in-game minute)

        this.require_tool = require_tool; //if false, can be started without tool equipped

        this.gained_resources = gained_resources; 
        //{scales_with_skill: boolean, resource: [{name, ammount: [[min,max], [min,max]], chance: [min,max]}], time_period: [min,max], skill_required: [min_efficiency, max_efficiency]}
        //every 2-value array is oriented [starting_value, value_with_required_skill_level], except for subarrays of ammount (which are for randomizing gained item count) and for skill_required
        //                                                                                   (ammount array itself follows the mentioned orientation)
        //value start scaling after reaching min_efficiency skill lvl, before that they are just all at min
        //skill required refers to level of every skill
        //if scales_with_skill is false, scalings will be ignored and first value will be used
        }

    getActivityEfficiency = function() {
        let skill_modifier = 1;
        if(this.gained_resources.scales_with_skill){
            let skill_level_sum = 0;
            for(let i = 0; i < activities[this.activity_name].base_skills_names?.length; i++) {
                skill_level_sum += Math.min(
                    this.gained_resources.skill_required[1]-this.gained_resources.skill_required[0]+1, Math.max(0,skills[activities[this.activity_name].base_skills_names[i]].current_level-this.gained_resources.skill_required[0]+1)
                )/(this.gained_resources.skill_required[1]-this.gained_resources.skill_required[0]+1);
            }
            skill_modifier = (skill_level_sum/activities[this.activity_name].base_skills_names?.length) ?? 1;
        }
        const gathering_time_needed = Math.floor(this.gained_resources.time_period[0]*(this.gained_resources.time_period[1]/this.gained_resources.time_period[0])**skill_modifier);

        const gained_resources = [];

        for(let i = 0; i < this.gained_resources.resources.length; i++) {

            const chance = this.gained_resources.resources[i].chance[0]*(this.gained_resources.resources[i].chance[1]/this.gained_resources.resources[i].chance[0])**skill_modifier;
            const min = Math.round(this.gained_resources.resources[i].ammount[0][0]*(this.gained_resources.resources[i].ammount[1][0]/this.gained_resources.resources[i].ammount[0][0])**skill_modifier);
            const max = Math.round(this.gained_resources.resources[i].ammount[0][1]*(this.gained_resources.resources[i].ammount[1][1]/this.gained_resources.resources[i].ammount[0][1])**skill_modifier);
            gained_resources.push({name: this.gained_resources.resources[i].name, count: [min,max], chance: chance});
        }

        return {gathering_time_needed, gained_resources};
    }
}

class LocationAction {
    constructor({
        action_text,
        success_text,
        failure_text,
        requirements = {},
        rewards = {},
        attempt_duration = 0,
        attempt_text = "",
        success_chance = 1,
        is_unlocked = true,
    }) {
        this.action_text = action_text;
        this.failure_text = failure_text; //text displayed on failure
        this.success_text = success_text; //text displayed on success
                                          //if action is supposed to be "impossible" for narrative purposes, just make it finish without unlocks and with text that says it failed
        this.requirements = requirements; //things needed to succeed {stats, items, money} 
        this.rewards = rewards; //mostly unlocks: {} but could be some other things
        this.completed = false;
        this.attempt_duration = attempt_duration; //0 means instantaneous, otherwise there's a progress bar
        this.attempt_text = attempt_text; //action text while attempting, useless if duration is 0
        this.success_chance = success_chance; //chance to succeed; to guarantee that multiple attempts will be needed, just make a few consecutive actions with same text
        this.is_unlocked = is_unlocked;
        this.is_finished = false;
    }

    /**
     * @returns {Boolean}
     */
    are_conditions_met() {

    }
}

class LocationType{
    constructor({name, related_skill, stages = {}}) {
        this.name = name;

        if(related_skill) {
            if(!skills[related_skill]) {
                throw new Error(`No such skill as "${related_skill}"`);
            }
            else { 
                this.related_skill = related_skill; //one per each; skill xp defined in location/combat_zone
            }
        }
        this.stages = stages; //up to 3
        /* 
        >number<: {
            description,
            related_skill,
            effects
        }

        */
    }
}

function get_location_type_penalty(type, stage, stat) {
    
    const skill = skills[location_types[type].stages[stage].related_skill];

    const base = location_types[type].stages[stage].effects.multipliers[stat];

    return base**(1- skill.current_level/skill.max_level);
}



//create location types
(function(){
    
    location_types["bright"] = new LocationType({
        name: "bright",
        stages: {
            1: {
                description: "A place that's always lit, no matter the time of the day",
            },
            2: {
                description: "An extremely bright place, excessive light makes it hard to keep eyes open",
                related_skill: "Dazzle resistance",
                effects: {
                    multipliers: {
                        attack_points: 0.5,
                        evasion_points: 0.5,
                    }
                }
            },
            3: {
                description: "A place with so much light that an average person would go blind in an instant",
                related_skill: "Dazzle resistance",
                effects: {
                    multipliers: {
                        attack_points: 0.1,
                        evasion_points: 0.1,
                    }
                }
            }
        }
    });
    location_types["dark"] = new LocationType({
        name: "dark",
        stages: {
            1: {
                description: "A place where it's always as dark as during a bright night",
                related_skill: "Night vision",
                //no effects here, since in this case they are provided via the overall "night" penalty
            },
            2: {
                description: "An extremely dark place, darker than most of the nights",
                related_skill: "Night vision",
                effects: {
                    multipliers: {
                        //they dont need to be drastic since they apply on top of 'night' penalty
                        attack_points: 0.8,
                        evasion_points: 0.8,
                    }
                }
            },
            3: {
                description: "Pure darkness with not even a tiniest flicker of light",
                related_skill: "Presence sensing",
                effects: {
                    multipliers: {
                        attack_points: 0.15,
                        evasion_points: 0.15,
                    }
                }
            }
        }
    });
    location_types["narrow"] = new LocationType({
        name: "narrow",
        stages: {
            1: {
                description: "A very narrow and tight area where there's not much place for maneuvering",
                related_skill: "Tight maneuvers",
                effects: {
                    multipliers: {
                        evasion_points: 0.333,
                                }
                        }
                }
            }
    });
    location_types["open"] = new LocationType({
        name: "open",
        stages: {
            1: {
                description: "A completely open area where attacks can come from any direction",
                related_skill: "Spatial awareness",
                effects: {
                    multipliers: {
                        evasion_points: 0.75,
                    }
                }
            },
            2: {
                description: "An area that's completely open and simultanously obstructs your view, making it hard to predict where an attack will come from",
                related_skill: "Spatial awareness",
                effects: {
                    multipliers: {
                        evasion_points: 0.5,
                    }
                }
            }
        }
    });
    location_types["hot"] = new LocationType({
        name: "hot",
        stages: {
            1: {
                description: "High temperature makes it hard to breath",
                related_skill: "Heat resistance",
                effects: {
                    multipliers: {
                        attack_points: 0.5,
                        evasion_points: 0.5,
                        stamina_efficiency: 0.9,
                    }
                }
            },
            2: {
                description: "It's so hot that just being here is painful",
                related_skill: "Heat resistance",
                effects: {
                    multipliers: {
                        attack_points: 0.3,
                        evasion_points: 0.3,
                        stamina_efficiency: 0.8,
                    }
                }
            },
            3: {
                description: "Temperature so high that wood ignites by itself",
                related_skill: "Heat resistance",
                //TODO: environmental damage if resistance is too low
                effects: {
                    multipliers: {
                        attack_points: 0.1,
                        evasion_points: 0.1,
                        stamina_efficiency: 0.5,
                    }
                }
            }
        }
    });
    location_types["cold"] = new LocationType({
        name: "cold",
        stages: {
            1: {
                description: "Cold makes your energy seep out...",
                related_skill: "Cold resistance",
                effects: {
                    multipliers: {
                        stamina_efficiency: 0.8,
                    }
                }
            },
            2: {
                description: "So cold...",
                related_skill: "Cold resistance",
                effects: {
                    multipliers: {
                        attack_points: 0.7,
                        evasion_points: 0.7,
                        stamina_efficiency: 0.7,
                    }
                }
            },
            3: {
                description: "This place is so cold, lesser beings would freeze in less than a minute...",
                related_skill: "Cold resistance",
                //TODO: environmental damage if resistance is too low (to both hp and stamina?)
                effects: {
                    multipliers: {
                        attack_points: 0.5,
                        evasion_points: 0.5,
                        stamina_efficiency: 0.4,
                    }
                }
            }
        }
    });
	
  location_types["unstable"] = new LocationType({
        name: "unstable",
        stages: {
            1: {
                description: "Tricky terrain makes dodging difficult",
                related_skill: "Equilibrium",
                effects: {
                    multipliers: {
                        evasion_points: 0.1,
                    }
                }
            },
        }
    });
	
 location_types["noxious"] = new LocationType({
        name: "noxious",
        stages: {
            1: {
                description: "noxious",
                related_skill: "Poison resistance",
                effects: {
                    multipliers: {
                        evasion_points: 0.1,
                    }
                }
            },
        }
    });	
location_types["cursed"] = new LocationType({
        name: "cursed",
        stages: {
            1: {
                description: "cursed1",
                related_skill: "Curse resistance",
                effects: {
                    multipliers: {
                        attack_points: 0.8,
                        evasion_points: 0.8,
                    }
                }
            },
            2: {
                description: "cursed2",
                related_skill: "Curse resistance",
                effects: {
                    multipliers: {
                        attack_points: 0.6,
                        evasion_points: 0.6,
                    }
                }
            },
            3: {
                description: "cursed3",
                related_skill: "Curse resistance",
                effects: {
                    multipliers: {
                        attack_points: 0.35,
                        evasion_points: 0.35,
                    }
                }
            }
        }
    });
	
location_types["thundering"] = new LocationType({
        name: "thundering",
        stages: {
            1: {
                description: "thundering1",
                related_skill: "Shock resistance",
                effects: {
                    multipliers: {
                        attack_points: 0.8,
                        evasion_points: 0.8,
                    }
                }
            },
            2: {
                description: "thundering2",
                related_skill: "Shock resistance",
                effects: {
                    multipliers: {
                        attack_points: 0.6,
                        evasion_points: 0.6,
                    }
                }
            },
            3: {
                description: "thundering3",
                related_skill: "Shock resistance",
                effects: {
                    multipliers: {
                        attack_points: 0.35,
                        evasion_points: 0.35,
                    }
                }
            }
        }
    });
})();


//create locations and zones
(function(){
	locations["Burial Chamber"] = new Location({
        connected_locations: [],
        description: "A barren empty room, save for a stone slab.",
        name: "Burial Chamber",
		traders: ["debug trader"],
        is_unlocked: true,
        sleeping: {
            text: "Take a nap",
            xp: 1},
    })

	
    locations["Village"] = new Location({ 
        connected_locations: [], 
        getDescription: function() {
            if(locations["Infested field"].enemy_groups_killed >= 5 * locations["Infested field"].enemy_count) { 
                return "Medium-sized village, built next to a small river at the foot of the mountains. It's surrounded by many fields, a few of them infested by huge rats, which, while an annoyance, don't seem possible to fully eradicate. Other than that, there's nothing interesting around";
            }
            else if(locations["Infested field"].enemy_groups_killed >= 2 * locations["Infested field"].enemy_count) {
                return "Medium-sized village, built next to a small river at the foot of the mountains. It's surrounded by many fields, many of them infested by huge rats. Other than that, there's nothing interesting around";
            } else {
                return "Medium-sized village, built next to a small river at the foot of the mountains. It's surrounded by many fields, most of them infested by huge rats. Other than that, there's nothing interesting around"; 
            }
        },
        getBackgroundNoises: function() {
            let noises = ["*You hear some rustling*"];
            if(current_game_time.hour > 4 && current_game_time.hour <= 20) {
                noises.push("Anyone seen my cow?", "Mooooo!", "Tomorrow I'm gonna fix the roof", "Look, a bird!");

                if(locations["Infested field"].enemy_groups_killed <= 3) {
                    noises.push("These nasty rats almost ate my cat!");
                }
            }

            if(current_game_time.hour > 3 && current_game_time.hour < 10) {
                noises.push("♫♫ Heigh ho, heigh ho, it's off to work I go~ ♫♫", "Cock-a-doodle-doo!");
            } else if(current_game_time.hour > 18 && current_game_time.hour < 22) {
                noises.push("♫♫ Heigh ho, heigh ho, it's home from work I go~ ♫♫");
            } 

            return noises;
        },
        dialogues: ["village elder", "village guard", "old craftsman"],
        traders: ["village trader"],
        name: "Village", 
        crafting: {
            is_unlocked: true, 
            use_text: "Try to craft something", 
            tiers: {
                crafting: 1,
                forging: 1,
                smelting: 1,
                cooking: 1,
                alchemy: 1,
            }
        },
    });

    locations["Shack"] = new Location({
        connected_locations: [{location: locations["Village"], custom_text: "Go outside"}],
        description: "This small shack was the only spare building in the village. It's surprisingly tidy.",
        name: "Shack",
        is_unlocked: false,
        sleeping: {
            text: "Take a nap",
            xp: 1},
    })

    locations["Village"].connected_locations.push({location: locations["Shack"]});
    //remember to always add it like that, otherwise travel will be possible only in one direction and location might not even be reachable

    locations["Infested field"] = new Combat_zone({
        description: "Field infested with wolf rats. You can see the grain stalks move as these creatures scurry around.", 
        enemy_count: 15, 
        enemies_list: ["Starving wolf rat", "Wolf rat"],
        types: [{type: "open", stage: 1, xp_gain: 1}],
        enemy_stat_variation: 0.1,
        is_unlocked: false, 
        name: "Infested field", 
        parent_location: locations["Village"],
        first_reward: {
            xp: 10,
        },
        repeatable_reward: {
            textlines: [
                {dialogue: "village elder", lines: ["cleared field"]},
            ],
            xp: 5,
        }
    });
    locations["Village"].connected_locations.push({location: locations["Infested field"]});

    locations["Nearby cave"] = new Location({ 
        connected_locations: [{location: locations["Village"], custom_text: "Go outside and to the village"}], 
        getDescription: function() {
            if(locations["Pitch black tunnel"].enemy_groups_killed >= locations["Pitch black tunnel"].enemy_count) { 
                return "A big cave near the village, once used as a storeroom. Groups of fluorescent mushrooms cover the walls, providing a dim light. Your efforts have secured a decent space and many of the tunnels. It seems like you almost reached the deepest part.";
            }
            else if(locations["Hidden tunnel"].enemy_groups_killed >= locations["Hidden tunnel"].enemy_count) { 
                return "A big cave near the village, once used as a storeroom. Groups of fluorescent mushrooms cover the walls, providing a dim light. Your efforts have secured a major space and some tunnels, but there are still more places left to clear out.";
            }
            else if(locations["Cave depths"].enemy_groups_killed >= locations["Cave depths"].enemy_count) { 
                return "A big cave near the village, once used as a storeroom. Groups of fluorescent mushrooms cover the walls, providing a dim light. Your efforts have secured a decent space and even a few tunnels, yet somehow you can still hear the sounds of the wolf rats.";
            }
            else if(locations["Cave room"].enemy_groups_killed >= locations["Cave room"].enemy_count) {
                return "A big cave near the village, once used as a storeroom. Groups of fluorescent mushrooms cover the walls, providing a dim light. Your efforts have secured some space, but you can hear more wolf rats in some deeper tunnels.";
            } else {
                return "A big cave near the village, once used as a storeroom. Groups of fluorescent mushrooms cover the walls, providing a dim light. You can hear sounds of wolf rats from the nearby room.";
            }
        },
        getBackgroundNoises: function() {
            let noises = ["*You hear rocks rumbling somewhere*", "Squeak!", ];
            return noises;
        },
        name: "Nearby cave",
        is_unlocked: false,
    });
    locations["Village"].connected_locations.push({location: locations["Nearby cave"]});
    //remember to always add it like that, otherwise travel will be possible only in one direction and location might not even be reachable

    locations["Cave room"] = new Combat_zone({
        description: "It's full of rats. At least the glowing mushrooms provide some light.", 
        enemy_count: 25, 
        types: [{type: "narrow", stage: 1,  xp_gain: 3}, {type: "bright", stage:1}],
        enemies_list: ["Wolf rat"],
        enemy_group_size: [2,3],
        enemy_stat_variation: 0.2,
        is_unlocked: true, 
        name: "Cave room", 
        leave_text: "Go back to entrance",
        parent_location: locations["Nearby cave"],
        first_reward: {
            xp: 20,
        },
        repeatable_reward: {
            locations: [{location: "Cave depths"}],
            xp: 10,
            activities: [{location:"Nearby cave", activity:"weightlifting"}, {location:"Nearby cave", activity:"mining"}, {location:"Village", activity:"balancing"}],
        }
    });
    locations["Nearby cave"].connected_locations.push({location: locations["Cave room"]});

    locations["Cave depths"] = new Combat_zone({
        description: "It's dark. And full of rats.", 
        enemy_count: 50, 
        types: [{type: "narrow", stage: 1,  xp_gain: 3}, {type: "dark", stage: 2, xp_gain: 3}],
        enemies_list: ["Wolf rat"],
        enemy_group_size: [5,8],
        enemy_stat_variation: 0.2,
        is_unlocked: false, 
        name: "Cave depths", 
        leave_text: "Climb out",
        parent_location: locations["Nearby cave"],
        first_reward: {
            xp: 30,
        },
        repeatable_reward: {
            textlines: [{dialogue: "village elder", lines: ["cleared cave"]}],
            locations: [{location: "Suspicious wall", required_clears: 4}],
            xp: 15,
        }
    });
    
    locations["Hidden tunnel"] = new Combat_zone({
        description: "There is, in fact, even more rats here.", 
        enemy_count: 50, 
        types: [{type: "narrow", stage: 1,  xp_gain: 3}, {type: "dark", stage: 3, xp_gain: 1}],
        enemies_list: ["Elite wolf rat"],
        enemy_group_size: [2,2],
        enemy_stat_variation: 0.2,
        is_unlocked: false, 
        name: "Hidden tunnel", 
        leave_text: "Retreat for now",
        parent_location: locations["Nearby cave"],
        first_reward: {
            xp: 100,
        },
        repeatable_reward: {
            locations: [{location: "Pitch black tunnel"}],
            xp: 50,
            activities: [{location:"Nearby cave", activity:"mining2"}],
        },
        unlock_text: "As the wall falls apart, you find yourself in front of a new tunnel, leading even deeper. And of course, it's full of wolf rats."
    });
    locations["Pitch black tunnel"] = new Combat_zone({
        description: "There is no light here. Only rats.", 
        enemy_count: 50, 
        types: [{type: "narrow", stage: 1,  xp_gain: 6}, {type: "dark", stage: 3, xp_gain: 3}],
        enemies_list: ["Elite wolf rat"],
        enemy_group_size: [6,8],
        enemy_stat_variation: 0.2,
        is_unlocked: false, 
        name: "Pitch black tunnel", 
        leave_text: "Retreat for now",
        parent_location: locations["Nearby cave"],
        first_reward: {
            xp: 200,
        },
        repeatable_reward: {
            xp: 100,
            locations: [{location: "Mysterious gate", required_clears: 4}],
        },
        unlock_text: "As you keep going deeper, you barely notice a pitch black hole. Not even a tiniest speck of light reaches it."
    });

    locations["Mysterious gate"] = new Combat_zone({
        description: "It's dark. And full of rats.", 
        enemy_count: 50, 
        types: [{type: "dark", stage: 3, xp_gain: 5}],
        enemies_list: ["Elite wolf rat guardian"],
        enemy_group_size: [6,8],
        enemy_stat_variation: 0.2,
        is_unlocked: false,
        name: "Mysterious gate", 
        leave_text: "Get away",
        parent_location: locations["Nearby cave"],
        first_reward: {
            xp: 500,
        },
        repeatable_reward: {
            xp: 250,
        },
        unlock_text: "After a long and ardous fight, you reach a chamber that ends with a massive stone gate. You can see it's guarded by some kind of wolf rats, but much bigger than the ones you fought until now."
    });


    locations["Nearby cave"].connected_locations.push(
        {location: locations["Cave depths"]}, 
        {location: locations["Hidden tunnel"], custom_text: "Enter the hidden tunnel"}, 
        {location: locations["Pitch black tunnel"], custom_text: "Go into the pitch black tunnel"},
        {location: locations["Mysterious gate"], custom_text: "Go to the mysterious gate"}),

    locations["Forest road"] = new Location({ 
        connected_locations: [{location: locations["Village"]}],
        description: "Old trodden road leading through a dark forest, the only path connecting village to the town. You can hear some animals from the surrounding woods.",
        name: "Forest road",
        getBackgroundNoises: function() {
            let noises = ["*You hear some rustling*", "Roar!", "*You almost tripped on some roots*", "*You hear some animal running away*"];

            return noises;
        },
        is_unlocked: false,
    });
    locations["Village"].connected_locations.push({location: locations["Forest road"], custom_text: "Leave the village"});

    locations["Forest2"] = new Combat_zone({
        description: "Forest surrounding the village, a dangerous place", 
        enemies_list: ["Starving wolf", "Young wolf"],
        enemy_count: 30, 
        enemy_stat_variation: 0.2,
        name: "Forest", 
        parent_location: locations["Forest road"],
        first_reward: {
            xp: 40,
        },
        repeatable_reward: {
            xp: 20,
            locations: [{location:"Deep forest"}],
            activities: [{location:"Forest road", activity: "herbalism"}],
        },
    });
    locations["Forest road"].connected_locations.push({location: locations["Forest2"], custom_text: "Leave the safe path"});

    locations["Deep forest"] = new Combat_zone({
        description: "Deeper part of the forest, a dangerous place", 
        enemies_list: ["Wolf", "Starving wolf", "Young wolf"],
        enemy_count: 50, 
        enemy_group_size: [2,3],
        enemy_stat_variation: 0.2,
        is_unlocked: false,
        name: "Deep forest", 
        parent_location: locations["Forest road"],
        first_reward: {
            xp: 70,
        },
        repeatable_reward: {
            xp: 35,
            flags: ["is_deep_forest_beaten"],
            activities: [{location:"Forest road", activity: "woodcutting"}],
        }
    });
    locations["Forest road"].connected_locations.push({location: locations["Deep forest"], custom_text: "Venture deeper into the woods"});

    locations["Forest clearing"] = new Combat_zone({
        description: "A surprisingly big clearing hidden in the northern part of the forest, covered with very tall grass and filled with a mass of wild boars",
        enemies_list: ["Boar"],
        enemy_count: 50, 
        enemy_group_size: [4,7],
        is_unlocked: false,
        enemy_stat_variation: 0.2,
        name: "Forest clearing", 
        types: [{type: "open", stage: 2, xp_gain: 3}],
        parent_location: locations["Forest road"],
        first_reward: {
            xp: 200,
        },
        repeatable_reward: {
            xp: 100,
            textlines: [{dialogue: "farm supervisor", lines: ["defeated boars"]}],
        }
    });
    locations["Forest road"].connected_locations.push({location: locations["Forest clearing"], custom_text: "Go towards the clearing in the north"});

    locations["Town outskirts"] = new Location({ 
        connected_locations: [{location: locations["Forest road"], custom_text: "Return to the forest"}],
        description: "The town is surrounded by a tall stone wall. The only gate seems to be closed, with a lone guard outside. You can see farms to the north and slums to the south.",
        name: "Town outskirts",
        is_unlocked: true,
        dialogues: ["gate guard"],
    });
    locations["Forest road"].connected_locations.push({location: locations["Town outskirts"], custom_text: "Go towards the town"});

    locations["Slums"] = new Location({ 
        connected_locations: [{location: locations["Town outskirts"]}],
        description: "A wild settlement next to city walls, filled with decaying buildings and criminals",
        name: "Slums",
        is_unlocked: true,
        dialogues: ["suspicious man"],
        traders: ["suspicious trader"],
        getBackgroundNoises: function() {
            let noises = ["Cough cough", "*You hear a scream*", "*You hear someone sobbing*"];

            if(current_game_time.hour > 4 && current_game_time.hour <= 20) {
                noises.push("Please, do you have a coin to spare?");
            } else {
                noises.push("*Sounds of someone getting repeatedly stabbed*", "Scammed some fools for money today, time to get drunk");
            }
            return noises;
        },
    });
    locations["Town farms"] = new Location({ 
        connected_locations: [{location: locations["Town outskirts"]}],
        description: "Semi-private farms under jurisdiction of the city council. Full of life and sounds of heavy work.",
        name: "Town farms",
        is_unlocked: true,
        dialogues: ["farm supervisor"],
        getBackgroundNoises: function() {
            let noises = [];
            if(current_game_time.hour > 4 && current_game_time.hour <= 20) {
                noises.push("Mooooo!", "Look, a bird!", "Bark bark!", "*You notice a goat staring at you menacingly*", "Neigh!", "Oink oink");
            } else {
                noises.push("*You can hear some rustling*", "*You can hear snoring workers*");
            }

            if(current_game_time.hour > 3 && current_game_time.hour < 10) {
                noises.push("♫♫ Heigh ho, heigh ho, it's off to work I go~ ♫♫", "Cock-a-doodle-doo!");
            } else if(current_game_time.hour > 18 && current_game_time.hour < 22) {
                noises.push("♫♫ Heigh ho, heigh ho, it's home from work I go~ ♫♫");
            } 

            return noises;
        },
    });

    locations["Town outskirts"].connected_locations.push({location: locations["Town farms"]}, {location: locations["Slums"]});
})();
    
    locations["Catacombs"] = new Location({ 
        connected_locations: [{location: locations["Burial Chamber"], custom_text: "Return to the Burial Chamber"}],
        description: "A dismal place, full of restless dead. Test.",
        name: "Catacombs",
        is_unlocked: true,
    });
locations["Village"].connected_locations.push({location: locations["Catacombs"]});
locations["Burial Chamber"].connected_locations.push({location: locations["Catacombs"]});

    locations["Wandering Undead"] = new Combat_zone({
        description: "Deal with undead stragglers.", 
        enemy_count: 15, 
        enemies_list: ["Shambling Corpse"],
        types: [{type: "dark", stage: 1, xp_gain: 3}],
        enemy_stat_variation: 0.1,
        is_unlocked: true, 
        name: "Wandering Undead", 
        parent_location: locations["Catacombs"],
        first_reward: {
            xp: 10,
        },
        repeatable_reward: {
            xp: 5,
            locations: [{location: "Catacomb Beasts"}],
        },
    });
locations["Catacombs"].connected_locations.push({location: locations["Wandering Undead"]});
	
	locations["Sewer"] = new Location({ 
        connected_locations: [{location: locations["Catacombs"]}],
        description: "A place of filth and seqage. The stench is horrendous.",
        name: "Sewer",
        is_unlocked: true,
    });
locations["Catacombs"].connected_locations.push({location: locations["Sewer"]});

	locations["Deathwater Bog"] = new Location({ 
        connected_locations: [{location: locations["Sewer"]}],
        description: "Obligatory poison swamp.",
        name: "Deathwater Bog",
        is_unlocked: false,
    });
	
locations["Sewer"].connected_locations.push({location: locations["Deathwater Bog"]});

	locations["Sewer Depths"] = new Location({ 
        connected_locations: [{location: locations["Sewer"]}],
        description: "Deep sewers",
        name: "Sewer Depths",
        is_unlocked: false,
    });
	
locations["Sewer"].connected_locations.push({location: locations["Sewer Depths"]});

    locations["Catacomb Beasts"] = new Combat_zone({
        description: "Deal with catacomb beasts.", 
        enemy_count: 20, 
        enemies_list: ["Zombie Rat", "Bat"],
        types: [{type: "dark", stage: 1, xp_gain: 3}],
        enemy_stat_variation: 0.1,
        is_unlocked: false, 
        name: "Catacomb Beasts", 
        parent_location: locations["Catacombs"],
        first_reward: {
            xp: 10,
        },
        repeatable_reward: {
            xp: 5,
        },
        unlock_text: "After vanquishing the Shambling Corpse you push further into Catacombs, home to a different set of critters"
    });
    locations["Catacombs"].connected_locations.push({location: locations["Catacomb Beasts"]});


    locations["Sewer Beasts"] = new Combat_zone({
        description: "Deal with sewer beasts.", 
        enemy_count: 20, 
        enemies_list: ["Plague Rat"],
        types: [{type: "dark", stage: 1, xp_gain: 3}, {type: "narrow", stage: 1, xp_gain: 3}],
        enemy_stat_variation: 0.1,
		enemy_group_size: [2,3],
        is_unlocked: true, 
        name: "Sewer Beasts", 
        parent_location: locations["Sewer"],
        first_reward: {
            xp: 20,
        },
        repeatable_reward: {
            xp: 10,
			locations: [{location:"Deathwater Bog"}, {location:"Sewer Depths"}],
        }
    });
    locations["Sewer"].connected_locations.push({location: locations["Sewer Beasts"]});

	locations["Backstreets"] = new Location({ 
        connected_locations: [{location: locations["Sewer"]}],
        description: "Backsteets.",
        name: "Backstreets",
        is_unlocked: true,
    });
	
locations["Sewer"].connected_locations.push({location: locations["Backstreets"]});

    locations["Deep Sewer Beasts"] = new Combat_zone({
        description: "Deal with sewer beasts.", 
        enemy_count: 30, 
        enemies_list: ["Pinata"],
        types: [{type: "dark", stage: 2, xp_gain: 5}],
        enemy_stat_variation: 0.1,
        is_unlocked: true, 
        name: "Deep Sewer Beasts", 
        parent_location: locations["Sewer Depths"],
        first_reward: {
            xp: 50,
        },
        repeatable_reward: {
            xp: 20,
        }
    });
	
locations["Sewer Depths"].connected_locations.push({location: locations["Deep Sewer Beasts"]});
	
	locations["Sanctuary"] = new Location({ 
        connected_locations: [{location: locations["Backstreets"]}],
        description: "Sanctuary.",
       	dialogues: ["Sanctuary Gift"],
        traders: ["village trader"],
        name: "Sanctuary",
        sleeping: {
            text: "Rest in a vacant home",
            xp: 3},		
        crafting: {
            is_unlocked: true, 
            use_text: "Try to craft something", 
            tiers: {
                crafting: 1,
                forging: 1,
                smelting: 1,
                cooking: 1,
                alchemy: 1,
            },
        },
    });
	
locations["Backstreets"].connected_locations.push({location: locations["Sanctuary"]});

locations["Courtyard"] = new Location({ 
        connected_locations: [{location: locations["Backstreets"]}],
        description: "Courtyard",
        name: "Courtyard",
        is_unlocked: true,
    });
	
locations["Backstreets"].connected_locations.push({location: locations["Courtyard"]});

locations["Docks"] = new Location({ 
        connected_locations: [{location: locations["Courtyard"]}],
        description: "Docks",
        name: "Docks",
        is_unlocked: true,
    });
	
locations["Courtyard"].connected_locations.push({location: locations["Docks"]});

locations["Castle"] = new Location({ 
        connected_locations: [{location: locations["Courtyard"]}],
        description: "Castle",
        name: "Castle",
        is_unlocked: true,
    });
	
locations["Courtyard"].connected_locations.push({location: locations["Castle"]});

locations["Tower"] = new Location({ 
        connected_locations: [{location: locations["Courtyard"]}],
        description: "Tower",
        name: "Tower",
        is_unlocked: true,
    });
	
locations["Courtyard"].connected_locations.push({location: locations["Tower"]});

locations["The Midden"] = new Location({ 
        connected_locations: [{location: locations["Docks"]},{location: locations["Deathwater Bog"]}],
        description: ["The Midden"],
        name: ["The Midden"],
        is_unlocked: true,
    });
	
locations["Docks"].connected_locations.push({location: locations[["The Midden"]]});
locations["Deathwater Bog"].connected_locations.push({location: locations[["The Midden"]]});

locations["Burning Fields"] = new Location({ 
        connected_locations: [{location: locations["The Midden"]}],
        description: ["Burning Fields"],
        name: ["Burning Fields"],
        is_unlocked: false,
    });
	
locations["The Midden"].connected_locations.push({location: locations[["Burning Fields"]]});

locations["Fallen Palace"] = new Location({ 
        connected_locations: [{location: locations["Castle"]}],
        description: "Fallen Palace",
        name: "Fallen Palace",
        is_unlocked: true,
    });
	
locations["Castle"].connected_locations.push({location: locations["Fallen Palace"]});

locations["Throne Room"] = new Location({ 
        connected_locations: [{location: locations["Fallen Palace"]}],
        description: "Throne Room",
        name: "Throne Room",
        is_unlocked: true,
		sleeping: {
            text: "Rest in the Royal Bedchamber",
            xp: 10000},	
    });
	
locations["Fallen Palace"].connected_locations.push({location: locations["Throne Room"]});

locations["Laboratory"] = new Location({ 
        connected_locations: [{location: locations["Fallen Palace"]}],
        description: "Laboratory",
        name: "Laboratory",
        is_unlocked: true,
    });
	
locations["Fallen Palace"].connected_locations.push({location: locations["Laboratory"]});

locations["Royal Gardens"] = new Location({ 
        connected_locations: [{location: locations["Fallen Palace"]}],
        description: "Royal Gardens",
        name: "Royal Gardens",
        is_unlocked: true,
    });
	
locations["Fallen Palace"].connected_locations.push({location: locations["Royal Gardens"]});

locations["Vivarium"] = new Location({ 
        connected_locations: [{location: locations["Laboratory"]}],
        description: "Vivarium",
        name: "Vivarium",
        is_unlocked: true,
    });
	
locations["Laboratory"].connected_locations.push({location: locations["Vivarium"]});

locations["The Roost"] = new Location({ 
        connected_locations: [{location: locations["Vivarium"]}],
        description: "The Roost",
        name: "The Roost",
        is_unlocked: true,
    });
	
locations["Vivarium"].connected_locations.push({location: locations["The Roost"]});

locations["The Maelstrom"] = new Location({ 
        connected_locations: [{location: locations["The Roost"]}],
        description: "The Maelstrom",
        name: "The Maelstrom",
        is_unlocked: true,
    });
	
locations["The Roost"].connected_locations.push({location: locations["The Maelstrom"]});

locations["Well of Souls"] = new Location({ 
        connected_locations: [{location: locations["Vivarium"]}],
        description: "Well of Souls",
        name: "Well of Souls",
        is_unlocked: true,
    });
	
locations["Vivarium"].connected_locations.push({location: locations["Well of Souls"]});

locations["Glacier Wing"] = new Location({ 
        connected_locations: [{location: locations["Laboratory"]}],
        description: "Glacier Wing",
        name: "Glacier Wing",
        is_unlocked: true,
    });
	
locations["Laboratory"].connected_locations.push({location: locations["Glacier Wing"]});

locations["The Frozen Flame"] = new Location({ 
        connected_locations: [{location: locations["Glacier Wing"]}],
        description: "The Frozen Flame",
        name: "The Frozen Flame",
        is_unlocked: true,
    });
	
locations["Glacier Wing"].connected_locations.push({location: locations["The Frozen Flame"]});

locations["Prison"] = new Location({ 
        connected_locations: [{location: locations["Castle"]}],
        description: "Prison",
        name: "Prison",
        is_unlocked: true,
    });
	
locations["Castle"].connected_locations.push({location: locations["Prison"]});

locations["Penitent Halls"] = new Location({ 
        connected_locations: [{location: locations["Prison"]}],
        description: "Penitent Halls",
        name: "Penitent Halls",
        is_unlocked: true,
    });
	
locations["Prison"].connected_locations.push({location: locations["Penitent Halls"]});

locations["Castle Ramparts"] = new Location({ 
        connected_locations: [{location: locations["Castle"]}],
        description: "Castle Ramparts",
        name: "Castle Ramparts",
        is_unlocked: true,
    });
	
locations["Castle"].connected_locations.push({location: locations["Castle Ramparts"]});

locations["Castle Barracks"] = new Location({ 
        connected_locations: [{location: locations["Castle"]},{location: locations["Castle Ramparts"]}],
        description: "Castle Barracks",
        name: "Castle Barracks",
        is_unlocked: true,
    });
	
locations["Castle"].connected_locations.push({location: locations["Castle Barracks"]});
locations["Castle Ramparts"].connected_locations.push({location: locations["Castle Barracks"]});

locations["Catacomb Depths"] = new Location({ 
        connected_locations: [{location: locations["Catacombs"]}],
        description: "Catacomb Depths",
        name: "Catacomb Depths",
        is_unlocked: true,
    });
locations["Catacombs"].connected_locations.push({location: locations["Catacomb Depths"]});

locations["Cavern"] = new Location({ 
        connected_locations: [{location: locations["Catacombs"]}],
        description: "Cavern",
        name: "Cavern",
        is_unlocked: true,
    });
locations["Catacombs"].connected_locations.push({location: locations["Cavern"]});

locations["Forest"] = new Location({ 
        connected_locations: [{location: locations["Cavern"]},{location: locations["Sanctuary"]}],
        description: "Forest",
        name: "Forest",
        is_unlocked: true,
    });
locations["Cavern"].connected_locations.push({location: locations["Forest"]});
locations["Sanctuary"].connected_locations.push({location: locations["Forest"]});

locations["Dark Woods"] = new Location({ 
        connected_locations: [{location: locations["Forest"]}],
        description: "Dark Woods",
        name: "Dark Woods",
        is_unlocked: true,
    });
locations["Forest"].connected_locations.push({location: locations["Dark Woods"]});

locations["Burrows"] = new Location({ 
        connected_locations: [{location: locations["Cavern"]}],
        description: "Burrows",
        name: "Burrows",
        is_unlocked: true,
    });
locations["Cavern"].connected_locations.push({location: locations["Burrows"]});

locations["Mines"] = new Location({ 
        connected_locations: [{location: locations["Cavern"]}],
        description: "Mines",
        name: "Mines",
        is_unlocked: true,
    });
locations["Cavern"].connected_locations.push({location: locations["Mines"]});

locations["Motherlode"] = new Location({ 
        connected_locations: [{location: locations["Mines"]}],
        description: "Motherlode",
        name: "Motherlode",
        is_unlocked: true,
    });
locations["Mines"].connected_locations.push({location: locations["Motherlode"]});

locations["The Platinum Pile"] = new Location({ 
        connected_locations: [{location: locations["Mines"]}],
        description: "The Platinum Pile",
        name: "The Platinum Pile",
        is_unlocked: true,
    });
locations["Mines"].connected_locations.push({location: locations["The Platinum Pile"]});

locations["The Nest"] = new Location({ 
        connected_locations: [{location: locations["Burrows"]}],
        description: "The Nest",
        name: "The Nest",
        is_unlocked: true,
    });
locations["Burrows"].connected_locations.push({location: locations["The Nest"]});

locations["Fire Pit"] = new Location({ 
        connected_locations: [{location: locations["The Nest"]}],
        description: "Fire Pit",
        name: "Fire Pit",
        is_unlocked: true,
    });
locations["The Nest"].connected_locations.push({location: locations["Fire Pit"]});

locations["Lava Lake"] = new Location({ 
        connected_locations: [{location: locations["Fire Pit"]}],
        description: "Lava Lake",
        name: "Lava Lake",
        is_unlocked: true,
    });
locations["Fire Pit"].connected_locations.push({location: locations["Lava Lake"]});

locations["Grave of Heroes"] = new Location({ 
        connected_locations: [{location: locations["Burrows"]},{location: locations["Catacomb Depths"]}],
        description: "Grave of Heroes",
        name: "Grave of Heroes",
        is_unlocked: true,
    });
locations["Burrows"].connected_locations.push({location: locations["Grave of Heroes"]});
locations["Catacomb Depths"].connected_locations.push({location: locations["Grave of Heroes"]});

locations["Ancient Bridge"] = new Location({ 
        connected_locations: [{location: locations["Grave of Heroes"]}],
        description: "Ancient Bridge",
        name: "Ancient Bridge",
        is_unlocked: true,
    });
locations["Grave of Heroes"].connected_locations.push({location: locations["Ancient Bridge"]});

locations["Ruined Kingdom"] = new Location({ 
        connected_locations: [{location: locations["Ancient Bridge"]}],
        description: "Ruined Kingdom",
        name: "Ruined Kingdom",
        is_unlocked: false,
    });
locations["Ancient Bridge"].connected_locations.push({location: locations["Ruined Kingdom"]});

locations["Forgotten Vault"] = new Location({ 
        connected_locations: [{location: locations["Ruined Kingdom"]}],
        description: "Forgotten Vault",
        name: "Forgotten Vault",
        is_unlocked: true,
    });
locations["Ruined Kingdom"].connected_locations.push({location: locations["Forgotten Vault"]});

locations["Execution Chamber"] = new Location({ 
        connected_locations: [{location: locations["Forgotten Vault"]},{location: locations["Penitent Halls"]}],
        description: "Execution Chamber",
        name: "Execution Chamber",
        is_unlocked: true,
    });
locations["Penitent Halls"].connected_locations.push({location: locations["Execution Chamber"]});

locations["Cathedral of the Damned"] = new Location({ 
        connected_locations: [{location: locations["Forgotten Vault"]},{location: locations["Execution Chamber"]}],
        description: "Cathedral of the Damned",
        name: "Cathedral of the Damned",
        is_unlocked: true,
    });
locations["Forgotten Vault"].connected_locations.push({location: locations["Cathedral of the Damned"]});
locations["Execution Chamber"].connected_locations.push({location: locations["Cathedral of the Damned"]});

locations["Unholy Sanctum"] = new Location({ 
        connected_locations: [{location: locations["Well of Souls"]},{location: locations["Cathedral of the Damned"]}],
        description: "Unholy Sanctum",
        name: "Unholy Sanctum",
        is_unlocked: true,
    });
locations["Well of Souls"].connected_locations.push({location: locations["Unholy Sanctum"]});
locations["Cathedral of the Damned"].connected_locations.push({location: locations["Unholy Sanctum"]});


locations["Village"].connected_locations.push({location: locations["Catacombs"]}); //link to old zones, can turn on and off by commenting out these 2 lines
locations["Catacombs"].connected_locations.push({location: locations["Village"]});

locations["Mine Dwellers"] = new Combat_zone({
        description: "Mine Dwellers", 
        enemy_count: 25, 
        types: [{type: "narrow", stage: 1,  xp_gain: 3}],
        enemies_list: ["Pinata"],
        enemy_group_size: [2,3],
        enemy_stat_variation: 0.2,
        is_unlocked: true, 
        name: "Mine Dwellers", 
        leave_text: "Go back to entrance",
        parent_location: locations["Mines"],
        first_reward: {
            xp: 20,
        },
        repeatable_reward: {
            xp: 10,
            activities: [{location:"Mines", activity:"mining"}],
        }
    });
locations["Mines"].connected_locations.push({location: locations["Mine Dwellers"]});


locations["Massed Undead"] = new Combat_zone({
        description: "Strange Knight", 
        enemy_count: 25, 
        types: [],
        enemies_list: ["Skeleton", "Zombie"],
        enemy_group_size: [3,4],
        enemy_stat_variation: 0.2,
        is_unlocked: true, 
        name: "Massed Undead",
        parent_location: locations["Catacomb Depths"],
        first_reward: {
            xp: 80,
        },
        repeatable_reward: {
            xp: 40,
		locations: [{location:"Undead Horde"}],
        }
    });
locations["Catacomb Depths"].connected_locations.push({location: locations["Massed Undead"]});

locations["Undead Horde"] = new Combat_zone({
        description: "Undead Horde", 
        enemy_count: 25, 
        types: [],
        enemies_list: ["Blighted One", "Skeleton Archer"],
        enemy_group_size: [5,6],
        enemy_stat_variation: 0.2,
        is_unlocked: false, 
        name: "Undead Horde",
        parent_location: locations["Catacomb Depths"],
        first_reward: {
            xp: 160,
        },
        repeatable_reward: {
            xp: 80,
        }
    });
locations["Catacomb Depths"].connected_locations.push({location: locations["Undead Horde"]});


locations["Strange Knight"] = new Challenge_zone({
        description: "Strange Knight", 
        enemy_count: 1, 
        types: [],
        enemies_list: ["Village guard (heavy)"],
        enemy_group_size: [1,1],
        enemy_stat_variation: 0.2,
        is_unlocked: true, 
        name: "Strange Knight",
        parent_location: locations["Catacomb Depths"],
        first_reward: {
            xp: 20,
        },
        repeatable_reward: {
            xp: 10,
        }
    });
locations["Catacomb Depths"].connected_locations.push({location: locations["Strange Knight"]});

locations["Restless Dead"] = new Combat_zone({
        description: "Restless Dead", 
        enemy_count: 30, 
        types: [{type: "dark", stage: 2,  xp_gain: 3}],
        enemies_list: ["Ghoul", "Skeleton Elite", "Spectre"],
        enemy_group_size: [5,6],
        enemy_stat_variation: 0.2,
        is_unlocked: true, 
        name: "Restless Dead",
        parent_location: locations["Grave of Heroes"],
        first_reward: {
            xp: 320,
        },
        repeatable_reward: {
            xp: 160,
        }
    });
locations["Grave of Heroes"].connected_locations.push({location: locations["Restless Dead"]});

locations["Forest Beasts"] = new Combat_zone({
        description: "Forest Beasts", 
		types: [{type: "open", stage: 1,  xp_gain: 3}],
        enemies_list: ["Wolf", "Starving wolf", "Young wolf"],
        enemy_count: 10, 
        enemy_group_size: [2,3],
        enemy_stat_variation: 0.2,
        is_unlocked: true,
        name: "Forest Beasts", 
        parent_location: locations["Forest"],
        first_reward: {
            xp: 70,
        },
        repeatable_reward: {
            xp: 35,
            activities: [{location:"Forest", activity: "woodcutting"}],
        }
    });
locations["Forest"].connected_locations.push({location: locations["Forest Beasts"], custom_text: "Forest Beasts"});

locations["The Dregs"] = new Combat_zone({
        description: "The Dregs", 
		types: [],
        enemies_list: ["Pinata"],
        enemy_count: 10, 
        enemy_group_size: [2,3],
        enemy_stat_variation: 0.2,
        is_unlocked: true,
        name: "The Dregs", 
        parent_location: locations["The Midden"],
        first_reward: {
            xp: 70,
        },
        repeatable_reward: {
            xp: 35,
			locations: [{location:"Burning Fields"}],
        }
    });
locations["The Midden"].connected_locations.push({location: locations["The Dregs"], custom_text: "Face the Dregs"});

locations["The Dregs2"] = new Combat_zone({
        description: "The Dregs2", 
		types: [],
        enemies_list: ["Pinata"],
        enemy_count: 10, 
        enemy_group_size: [2,3],
        enemy_stat_variation: 0.2,
        is_unlocked: true,
        name: "The Dregs2", 
        parent_location: locations["The Midden"],
        first_reward: {
            xp: 70,
        },
        repeatable_reward: {
            xp: 35,
        }
    });
locations["Burning Fields"].connected_locations.push({location: locations["The Dregs2"], custom_text: "Face the Dregs2"});


locations["Fire Beasts"] = new Combat_zone({
        description: "Fire Beasts", 
		types: [{type: "hot", stage: 1,  xp_gain: 3}, {type: "bright", stage: 1,  xp_gain: 3}],
        enemies_list: ["Pinata"],
        enemy_count: 10, 
        enemy_group_size: [2,3],
        enemy_stat_variation: 0.2,
        is_unlocked: true,
        name: "Fire Beasts", 
        parent_location: locations["Fire Pit"],
        first_reward: {
            xp: 70,
        },
        repeatable_reward: {
            xp: 35,
			locations: [{location:"Fire Beasts2"}],
        }
    });
locations["Fire Pit"].connected_locations.push({location: locations["Fire Beasts"], custom_text: "Fire Beasts"});

locations["Fire Beasts2"] = new Combat_zone({
        description: "Fire Beasts2", 
		types: [{type: "hot", stage: 2,  xp_gain: 5}, {type: "bright", stage: 1,  xp_gain: 3}],
        enemies_list: ["Pinata"],
        enemy_count: 30, 
        enemy_group_size: [2,3],
        enemy_stat_variation: 0.2,
        is_unlocked: false,
        name: "Fire Beasts2", 
        parent_location: locations["Fire Pit"],
        first_reward: {
            xp: 140,
        },
        repeatable_reward: {
            xp: 70,
			locations: [{location:"Fire Beasts3"}],
        }
    });
locations["Fire Pit"].connected_locations.push({location: locations["Fire Beasts2"], custom_text: "Fire Beasts2"});

locations["Fire Beasts3"] = new Combat_zone({
        description: "Fire Beasts3", 
		types: [{type: "hot", stage: 3,  xp_gain: 10}, {type: "bright", stage: 2,  xp_gain: 3}],
        enemies_list: ["Pinata"],
        enemy_count: 50, 
        enemy_group_size: [2,3],
        enemy_stat_variation: 0.2,
        is_unlocked: false,
        name: "Fire Beasts3", 
        parent_location: locations["Fire Pit"],
        first_reward: {
            xp: 350,
        },
        repeatable_reward: {
            xp: 175,
        }
    });
locations["Fire Pit"].connected_locations.push({location: locations["Fire Beasts3"], custom_text: "Fire Beasts3"});

locations["Ice Beasts"] = new Combat_zone({
        description: "Ice Beasts", 
		types: [{type: "cold", stage: 1,  xp_gain: 3}],
        enemies_list: ["Pinata"],
        enemy_count: 10, 
        enemy_group_size: [2,3],
        enemy_stat_variation: 0.2,
        is_unlocked: true,
        name: "Ice Beasts", 
        parent_location: locations["Glacier Wing"],
        first_reward: {
            xp: 70,
        },
        repeatable_reward: {
            xp: 35,
			locations: [{location:"Ice Beasts2"}],
        }
    });
locations["Glacier Wing"].connected_locations.push({location: locations["Ice Beasts"], custom_text: "Ice Beasts"});

locations["Ice Beasts2"] = new Combat_zone({
        description: "Ice Beasts2", 
		types: [{type: "cold", stage: 2,  xp_gain: 5}],
        enemies_list: ["Pinata"],
        enemy_count: 30, 
        enemy_group_size: [2,3],
        enemy_stat_variation: 0.2,
        is_unlocked: false,
        name: "Ice Beasts2", 
        parent_location: locations["Glacier Wing"],
        first_reward: {
            xp: 140,
        },
        repeatable_reward: {
            xp: 70,
			locations: [{location:"Ice Beasts3"}],
        }
    });
locations["Glacier Wing"].connected_locations.push({location: locations["Ice Beasts2"], custom_text: "Ice Beasts2"});

locations["Ice Beasts3"] = new Combat_zone({
        description: "Ice Beasts3", 
		types: [{type: "cold", stage: 3,  xp_gain: 10}],
        enemies_list: ["Pinata"],
        enemy_count: 50, 
        enemy_group_size: [2,3],
        enemy_stat_variation: 0.2,
        is_unlocked: false,
        name: "Ice Beasts3", 
        parent_location: locations["Glacier Wing"],
        first_reward: {
            xp: 350,
        },
        repeatable_reward: {
            xp: 175,
        }
    });
locations["Glacier Wing"].connected_locations.push({location: locations["Ice Beasts3"], custom_text: "Ice Beasts3"});

locations["Chaos Beasts"] = new Combat_zone({
        description: "Chaos Beasts", 
		types: [{type: "cold", stage: 2,  xp_gain: 5}, {type: "hot", stage: 2,  xp_gain: 5}],
        enemies_list: ["Pinata"],
        enemy_count: 10, 
        enemy_group_size: [2,3],
        enemy_stat_variation: 0.2,
        is_unlocked: true,
        name: "Chaos Beasts", 
        parent_location: locations["The Frozen Flame"],
        first_reward: {
            xp: 7000,
        },
        repeatable_reward: {
            xp: 3500,
        }
    });
locations["The Frozen Flame"].connected_locations.push({location: locations["Chaos Beasts"], custom_text: "Chaos Beasts"});

locations["Bridge Crossing"] = new Combat_zone({
        description: "Bridge Crossing", 
		types: [{type: "unstable", stage: 1,  xp_gain: 3}],
        enemies_list: ["Skeleton Champion", "Wraith"],
        enemy_count: 10, 
        enemy_group_size: [2,3],
        enemy_stat_variation: 0.2,
        is_unlocked: true,
        name: "Bridge Crossing", 
        parent_location: locations["Ancient Bridge"],
        first_reward: {
            xp: 640,
        },
        repeatable_reward: {
            xp: 1280,
			locations: [{location:"Ruined Kingdom"}],
        }
    });
locations["Ancient Bridge"].connected_locations.push({location: locations["Bridge Crossing"], custom_text: "Cross the bridge"});

locations["Toxic Enemies"] = new Combat_zone({
        description: "Toxic Enemies", 
		types: [{type: "noxious", stage: 1,  xp_gain: 4}],
        enemies_list: ["Pinata"],
        enemy_count: 10, 
        enemy_group_size: [2,3],
        enemy_stat_variation: 0.2,
        is_unlocked: true,
        name: "Toxic Enemies", 
        parent_location: locations["Deathwater Bog"],
        first_reward: {
            xp: 700,
        },
        repeatable_reward: {
            xp: 350,
        }
    });
locations["Deathwater Bog"].connected_locations.push({location: locations["Toxic Enemies"], custom_text: "Toxic Enemies"});

locations["Palace Menagerie"] = new Combat_zone({
        description: "Palace Menagerie", 
		types: [{type: "open", stage: 2,  xp_gain: 10}],
        enemies_list: ["Pinata"],
        enemy_count: 10, 
        enemy_group_size: [2,3],
        enemy_stat_variation: 0.2,
        is_unlocked: true,
        name: "Palace Menagerie", 
        parent_location: locations["Royal Gardens"],
        first_reward: {
            xp: 700,
        },
        repeatable_reward: {
            xp: 350,
			activities: [{location:"Royal Gardens", activity: "woodcutting2"}],
        }
    });
locations["Royal Gardens"].connected_locations.push({location: locations["Palace Menagerie"], custom_text: "Palace Menagerie"});

locations["Loose Specimens"] = new Combat_zone({
        description: "Loose Specimens", 
		types: [{type: "dark", stage: 2,  xp_gain: 10}],
        enemies_list: ["Undead Abomination", "Lesser Chimera", "Baby Wyvern", "Decrepit Construct"],
        enemy_count: 30, 
        enemy_group_size: [2,3],
        enemy_stat_variation: 0.2,
        is_unlocked: true,
        name: "Loose Specimens", 
        parent_location: locations["Laboratory"],
        first_reward: {
            xp: 3500,
        },
        repeatable_reward: {
            xp: 1750,
        }
    });
locations["Laboratory"].connected_locations.push({location: locations["Loose Specimens"]});


locations["Wild Dragons"] = new Combat_zone({
        description: "Wild Dragons", 
		types: [{type: "open", stage: 2,  xp_gain: 10}],
        enemies_list: ["Sea Dragon", "Ice Dragon", "Black Dragon", "Fire Dragon", "Thunder Dragon", "Earth Dragon"],
        enemy_count: 20, 
        enemy_group_size: [1,1],
        enemy_stat_variation: 0.2,
        is_unlocked: true,
        name: "Wild Dragons", 
        parent_location: locations["The Roost"],
        first_reward: {
            xp: 7000,
        },
        repeatable_reward: {
            xp: 3500,
        }
    });
locations["The Roost"].connected_locations.push({location: locations["Wild Dragons"]});

locations["Royal Rat's Court"] = new Combat_zone({
        description: "Royal Rat's Court", 
		types: [{type: "dark", stage: 3,  xp_gain: 10}, {type: "narrow", stage: 1,  xp_gain: 4}],
        enemies_list: ["Pinata"],
        enemy_count: 10, 
        enemy_group_size: [2,3],
        enemy_stat_variation: 0.2,
        is_unlocked: true,
        name: "Royal Rat's Court", 
        parent_location: locations["Sewer Depths"],
        first_reward: {
            xp: 700,
        },
        repeatable_reward: {
            xp: 350,
        }
    });
locations["Sewer Depths"].connected_locations.push({location: locations["Royal Rat's Court"], custom_text: "Royal Rat's Court"});


locations["Curse Enemies"] = new Combat_zone({
        description: "Curse Enemies", 
		types: [{type: "dark", stage: 1,  xp_gain: 1}, {type: "cursed", stage: 1,  xp_gain: 1}],
        enemies_list: ["Pinata"],
        enemy_count: 10, 
        enemy_group_size: [2,3],
        enemy_stat_variation: 0.2,
        is_unlocked: true,
        name: "Curse Enemies", 
        parent_location: locations["Execution Chamber"],
        first_reward: {
            xp: 700,
        },
        repeatable_reward: {
            xp: 350,
        }
    });
locations["Execution Chamber"].connected_locations.push({location: locations["Curse Enemies"], custom_text: "Curse Enemies"});

locations["Curse Enemies2"] = new Combat_zone({
        description: "Curse Enemies2", 
		types: [{type: "dark", stage: 1,  xp_gain: 5}, {type: "cursed", stage: 2,  xp_gain: 5}],
        enemies_list: ["Pinata"],
        enemy_count: 10, 
        enemy_group_size: [2,3],
        enemy_stat_variation: 0.2,
        is_unlocked: true,
        name: "Curse Enemies2", 
        parent_location: locations["Well of Souls"],
        first_reward: {
            xp: 7000,
        },
        repeatable_reward: {
            xp: 3500,
        }
    });
locations["Well of Souls"].connected_locations.push({location: locations["Curse Enemies2"], custom_text: "Curse Enemies2"});

locations["Curse Enemies3"] = new Combat_zone({
        description: "Curse Enemies3", 
		types: [{type: "dark", stage: 2,  xp_gain: 10}, {type: "cursed", stage: 3,  xp_gain: 10}],
        enemies_list: ["Pinata"],
        enemy_count: 10, 
        enemy_group_size: [2,3],
        enemy_stat_variation: 0.2,
        is_unlocked: true,
        name: "Curse Enemies3", 
        parent_location: locations["Unholy Sanctum"],
        first_reward: {
            xp: 70000,
        },
        repeatable_reward: {
            xp: 35000,
        }
    });
locations["Unholy Sanctum"].connected_locations.push({location: locations["Curse Enemies3"], custom_text: "Curse Enemies3"});

locations["Storm Enemies3"] = new Combat_zone({
        description: "Storm Enemies3", 
		types: [{type: "open", stage: 2,  xp_gain: 10}, {type: "bright", stage: 2,  xp_gain: 10}, {type: "thundering", stage: 3,  xp_gain: 10}],
        enemies_list: ["Pinata"],
        enemy_count: 10, 
        enemy_group_size: [2,3],
        enemy_stat_variation: 0.2,
        is_unlocked: true,
        name: "Storm Enemies3", 
        parent_location: locations["The Maelstrom"],
        first_reward: {
            xp: 70000,
        },
        repeatable_reward: {
            xp: 35000,
        }
    });
locations["The Maelstrom"].connected_locations.push({location: locations["Storm Enemies3"], custom_text: "Storm Enemies3"});

//combat zone types cheatsheet: bright 1/2/3, dark 1/2/3, narrow 1, open 1/2, hot 1/2/3, cold 1/2/3, unstable 1

//challenge zones
(function(){
    locations["Sparring with the village guard (heavy)"] = new Challenge_zone({
        description: "He's showing you a technique that makes his attacks slow but deadly",
        enemy_count: 1, 
        enemies_list: ["Village guard (heavy)"],
        enemy_group_size: [1,1],
        is_unlocked: false, 
        name: "Sparring with the village guard (heavy)", 
        leave_text: "Give up",
        parent_location: locations["Village"],
        first_reward: {
            xp: 30,
        },
        repeatable_reward: {
            textlines: [{dialogue: "village guard", lines: ["heavy"]}],
        },
        unlock_text: "You can now spar with the guard (heavy stance) in the Village"
    });
    locations["Sparring with the village guard (quick)"] = new Challenge_zone({
        description: "He's showing you a technique that makes his attacks slow but deadly",
        enemy_count: 1, 
        enemies_list: ["Village guard (quick)"],
        enemy_group_size: [1,1],
        is_unlocked: false, 
        name: "Sparring with the village guard (quick)", 
        leave_text: "Give up",
        parent_location: locations["Village"],
        first_reward: {
            xp: 30,
        },
        repeatable_reward: {
            textlines: [{dialogue: "village guard", lines: ["quick"]}],
        },
        unlock_text: "You can now spar with the guard (quick stance) in the Village"
    });
    locations["Village"].connected_locations.push(
        {location: locations["Sparring with the village guard (heavy)"], custom_text: "Spar with the guard [heavy]"},
        {location: locations["Sparring with the village guard (quick)"], custom_text: "Spar with the guard [quick]"}
    );

    locations["Suspicious wall"] = new Challenge_zone({
        description: "It can be broken with enough force, you can feel it", 
        enemy_count: 1, 
        types: [],
        enemies_list: ["Suspicious wall"],
        enemy_group_size: [1,1],
        enemy_stat_variation: 0,
        is_unlocked: false, 
        name: "Suspicious wall", 
        leave_text: "Leave it for now",
        parent_location: locations["Nearby cave"],
        repeatable_reward: {
            locations: [{location: "Hidden tunnel"}],
            textlines: [{dialogue: "village elder", lines: ["new tunnel"]}],
            xp: 20,
        },
        unlock_text: "At some point, one of wolf rats tries to escape through a previously unnoticed hole in a nearby wall. There might be another tunnel behind it!"
    });
    locations["Nearby cave"].connected_locations.push({location: locations["Suspicious wall"], custom_text: "Try to break the suspicious wall"});

    locations["Fight off the assailant"] = new Challenge_zone({
        description: "He attacked you out of nowhere", 
        enemy_count: 1, 
        types: [],
        enemies_list: ["Suspicious man"],
        enemy_group_size: [1,1],
        enemy_stat_variation: 0,
        is_unlocked: false, 
        name: "Fight off the assailant", 
        leave_text: "Run away for now",
        parent_location: locations["Slums"],
        repeatable_reward: {
            textlines: [{dialogue: "suspicious man", lines: ["defeated"]}],
            xp: 40,
        },
        unlock_text: "Defend yourself!"
    });
    locations["Slums"].connected_locations.push({location: locations["Fight off the assailant"], custom_text: "Fight off the suspicious man"});
})();

//add activities
(function(){
	locations["Catacombs"].activities = {
        "running": new LocationActivity({
            activity_name: "running",
            infinite: true,
            starting_text: "Run around the Catacombs",
            skill_xp_per_tick: 1,
            is_unlocked: true,
        }),
        "weightlifting": new LocationActivity({
            activity_name: "weightlifting",
            infinite: true,
            starting_text: "Lift heavy stones",
            skill_xp_per_tick: 1,
            is_unlocked: true,
        }), 
    };
	
	    locations["Sanctuary"].activities = {
        "fieldwork": new LocationActivity({
            activity_name: "fieldwork",
            starting_text: "Work on the fields",
            get_payment: () => {
                return 10 + Math.round(15 * skills["Farming"].current_level/skills["Farming"].max_level);
            },
            is_unlocked: true,
            working_period: 60*2,
            availability_time: {start: 6, end: 20},
            skill_xp_per_tick: 1, 
        }),
	};
		    locations["The Midden"].activities = {
        "salvaging": new LocationActivity({
            activity_name: "salvaging",
            starting_text: "Salvage scrap",
			infinite: true,
            get_payment: () => {
                return 10 + Math.round(30 * skills["Salvaging"].current_level/skills["Salvaging"].max_level);
            },
            is_unlocked: true,
            working_period: 60*2,
            skill_xp_per_tick: 2, 
        }),
	};
	
	
	
    locations["Village"].activities = {
        "fieldwork": new LocationActivity({
            activity_name: "fieldwork",
            starting_text: "Work on the fields",
            get_payment: () => {
                return 10 + Math.round(15 * skills["Farming"].current_level/skills["Farming"].max_level);
            },
            is_unlocked: false,
            working_period: 60*2,
            availability_time: {start: 6, end: 20},
            skill_xp_per_tick: 1, 
        }),
        "running": new LocationActivity({
            activity_name: "running",
            infinite: true,
            starting_text: "Go for a run around the village",
            skill_xp_per_tick: 1,
            is_unlocked: false,
        }),
        "weightlifting": new LocationActivity({
            activity_name: "weightlifting",
            infinite: true,
            starting_text: "Try to carry some bags of grain",
            skill_xp_per_tick: 1,
            is_unlocked: false,
        }),
        "balancing": new LocationActivity({
            activity_name: "balancing",
            infinite: true,
            starting_text: "Try to keep your balance on rocks in the river",
            unlock_text: "All this fighting while surrounded by stone and rocks gives you a new idea",
            skill_xp_per_tick: 1,
            is_unlocked: false,
        }),
        "meditating": new LocationActivity({
            activity_name: "meditating",
            infinite: true,
            starting_text: "Sit down and meditate",
            skill_xp_per_tick: 1,
            is_unlocked: true,
        }),
        "patrolling": new LocationActivity({
            activity_name: "patrolling",
            starting_text: "Go on a patrol around the village.",
            get_payment: () => {return 30},
            is_unlocked: false,
            infinite: true,
            working_period: 60*2,
            skill_xp_per_tick: 1
        }),
        "woodcutting": new LocationActivity({
            activity_name: "woodcutting",
            infinite: true,
            starting_text: "Gather some wood on the outskirts",
            skill_xp_per_tick: 1,
            is_unlocked: true,
            gained_resources: {
                resources: [{name: "Piece of rough wood", ammount: [[1,1], [1,3]], chance: [0.3, 1]}], 
                time_period: [20, 10],
                skill_required: [0, 10],
                scales_with_skill: true,
            },
            require_tool: false,
        }),
    };
    locations["Nearby cave"].activities = {
        "weightlifting": new LocationActivity({
            activity_name: "weightlifting",
            infinite: true,
            starting_text: "Try lifting some of the rocks",
            skill_xp_per_tick: 3,
            is_unlocked: false,
            unlock_text: "After the fight, you realize there's quite a lot of rocks of different sizes that could be used for exercises",
        }),
        "mining": new LocationActivity({
            activity_name: "mining",
            infinite: true,
            starting_text: "Mine the strange looking iron vein",
            skill_xp_per_tick: 1,
            is_unlocked: false,
            gained_resources: {
                resources: [{name: "Low quality iron ore", ammount: [[1,1], [1,3]], chance: [0.3, 0.7]}], 
                time_period: [60, 30],
                skill_required: [0, 10],
                scales_with_skill: true,
            },
            unlock_text: "As you clear the area of wolf rats, you notice a vein of an iron ore",
        }),
        "mining2": new LocationActivity({
            activity_name: "mining",
            infinite: true,
            starting_text: "Mine some of the deeper iron vein",
            skill_xp_per_tick: 5,
            is_unlocked: false,
            gained_resources: {
                resources: [{name: "Iron ore", ammount: [[1,1], [1,3]], chance: [0.1, 0.6]}], 
                time_period: [90, 40],
                skill_required: [7, 17],
                scales_with_skill: true,
            },
            unlock_text: "Going deeper, you find a vein of an iron ore that seems to be of much higher quality",
        }),
    };
    locations["Forest road"].activities = {
        "running": new LocationActivity({
            activity_name: "running",
            infinite: true,
            starting_text: "Go for a run through the forest",
            skill_xp_per_tick: 3,
        }),
        "woodcutting": new LocationActivity({
            activity_name: "woodcutting",
            infinite: true,
            starting_text: "Gather some wood from nearby trees",
            skill_xp_per_tick: 5,
            is_unlocked: false,
            gained_resources: {
                resources: [{name: "Piece of wood", ammount: [[1,1], [1,3]], chance: [0.1, 1]}],
                time_period: [90, 40],
                skill_required: [10, 20],
                scales_with_skill: true,
            },
        }),
        "herbalism": new LocationActivity({
            activity_name: "herbalism",
            infinite: true,
            starting_text: "Gather useful herbs throughout the forest",
            skill_xp_per_tick: 2,
            is_unlocked: false,
            gained_resources: {
                resources: [
                    {name: "Oneberry", ammount: [[1,1], [1,1]], chance: [0.1, 0.5]},
                    {name: "Golmoon leaf", ammount: [[1,1], [1,1]], chance: [0.1, 0.7]},
                    {name: "Belmart leaf", ammount: [[1,1], [1,1]], chance: [0.1, 0.7]}
                ], 
                time_period: [120, 45],
                skill_required: [0, 10],
                scales_with_skill: true,
            },
            require_tool: false,
        }),
    };
    locations["Town farms"].activities = {
        "fieldwork": new LocationActivity({
            activity_name: "fieldwork",
            starting_text: "Work on the fields",
            get_payment: () => {
                return 20 + Math.round(20 * skills["Farming"].current_level/skills["Farming"].max_level);
            },
            is_unlocked: false,
            working_period: 60*2,
            availability_time: {start: 6, end: 20},
            skill_xp_per_tick: 2,
        }),
        "animal care": new LocationActivity({
            activity_name: "animal care",
            infinite: true,
            starting_text: "Take care of local sheep in exchange for some wool",
            skill_xp_per_tick: 3,
            is_unlocked: false,
            gained_resources: {
                resources: [
                    {name: "Wool", ammount: [[1,1], [1,3]], chance: [0.1, 1]},
                ], 
                time_period: [120, 60],
                skill_required: [0, 10],
                scales_with_skill: true,
            },
            require_tool: false,
        }),
    };
	
locations["Mines"].activities = {
        "mining": new LocationActivity({
            activity_name: "mining",
            infinite: true,
            starting_text: "Mine the strange looking iron vein",
            skill_xp_per_tick: 1,
            is_unlocked: false,
            gained_resources: {
                resources: [{name: "Low quality iron ore", ammount: [[1,1], [1,3]], chance: [0.8, 1]}], 
                time_period: [20, 10],
                skill_required: [0, 20],
                scales_with_skill: true,
            },
            unlock_text: "After clearing out the enemies you can now mine iron.",
        }),
    };
	
locations["Forest"].activities = {
		"woodcutting": new LocationActivity({
            activity_name: "woodcutting",
            infinite: true,
            starting_text: "Gather some wood from nearby trees",
            skill_xp_per_tick: 5,
            is_unlocked: false,
            gained_resources: {
                resources: [{name: "Piece of wood", ammount: [[1,1], [1,3]], chance: [0.8, 1]}],
                time_period: [20, 10],
                skill_required: [0, 20],
                scales_with_skill: true,
            },
			unlock_text: "After clearing out the enemies you can now cut trees.",
        }),
    };
	
locations["Royal Gardens"].activities = {
		"woodcutting2": new LocationActivity({
            activity_name: "woodcutting",
            infinite: true,
            starting_text: "Gather some wood from the palace trees",
            skill_xp_per_tick: 10,
            is_unlocked: false,
            gained_resources: {
                resources: [{name: "Piece of wood", ammount: [[2,2], [2,6]], chance: [0.8, 1]}],
                time_period: [20, 10],
                skill_required: [0, 20],
                scales_with_skill: true,
            },
			unlock_text: "After clearing out the enemies you can now cut trees from the palace gardens.",
        }),
    };
	
locations["Burial Chamber"].activities = {
        "meditating": new LocationActivity({
            activity_name: "meditating",
            infinite: true,
            starting_text: "Sit down and meditate",
            skill_xp_per_tick: 1,
            is_unlocked: true,
        }),
    };
	
locations["Well of Souls"].activities = {
        "meditating": new LocationActivity({
            activity_name: "meditating",
            infinite: true,
            starting_text: "Sit down and meditate in the dense energy",
            skill_xp_per_tick: 10000,
            is_unlocked: true,
        }),
		 "manaexpansion": new LocationActivity({
            activity_name: "manaexpansion",
            infinite: true,
            starting_text: "Circulate energies",
            skill_xp_per_tick: 10000,
            is_unlocked: true,
        }),
    };


locations["Castle Barracks"].activities = {
        "weightlifting": new LocationActivity({
            activity_name: "weightlifting",
            infinite: true,
            starting_text: "Train with the knight's equipment",
            skill_xp_per_tick: 5,
            is_unlocked: true,
        }),
		"practice": new LocationActivity({
            activity_name: "practice",
            infinite: true,
            starting_text: "Practice your attacks",
            skill_xp_per_tick: 5,
        }),
    };
	
locations["Laboratory"].activities = {
        "running": new LocationActivity({
            activity_name: "running",
            infinite: true,
            starting_text: "Use the strange running equipment",
            skill_xp_per_tick: 5,
            is_unlocked: true,
        }),
    };
	
locations["Ruined Kingdom"].activities = {
        "patrolling": new LocationActivity({
            activity_name: "patrolling",
            starting_text: "Patrol the Ruined Kingdom.",
            get_payment: () => {return 60},
            is_unlocked: true,
            infinite: true,
            working_period: 60*2,
            skill_xp_per_tick: 8
        }),	
	};

})();


//add actions

export {locations, location_types, get_location_type_penalty};

/*
TODO:
    some "quick travel" location that would connect all important ones? (e.g. some towns?)
*/
