"use strict";

import { current_game_time } from "./game_time.js";
import { item_templates, getItem, book_stats, setLootSoldCount, loot_sold_count, recoverItemPrices, rarity_multipliers, getArmorSlot, loot_pools} from "./items.js";
import { locations, get_all_main_locations } from "./locations.js";
import { skills, weapon_type_to_skill, which_skills_affect_skill} from "./skills.js";
import { dialogues } from "./dialogues.js";
import { enemy_killcount, enemy_templates, rare_items_pool} from "./enemies.js";
import { traders } from "./traders.js";
import { is_in_trade, start_trade, cancel_trade, accept_trade, exit_trade, add_to_trader_inventory,
         add_to_buying_list, remove_from_buying_list, add_to_selling_list, remove_from_selling_list} from "./trade.js";
import { character, 
         add_to_character_inventory, remove_from_character_inventory,
         equip_item_from_inventory, unequip_item, equip_item,
         update_character_stats,
         get_skill_xp_gain } from "./character.js";
import { activities } from "./activities.js";
import { end_activity_animation, 
         update_displayed_character_inventory, update_displayed_trader_inventory, sort_displayed_inventory, sort_displayed_skills,
         update_displayed_money, log_message,
         update_displayed_enemies, update_displayed_health_of_enemies,
         update_displayed_combat_location, update_displayed_normal_location,
         log_loot, update_displayed_equipment,
		 log_rare_loot,
         update_displayed_health, update_displayed_stamina, update_displayed_mana,
         format_money, update_displayed_stats,
         update_displayed_effects, update_displayed_effect_durations,
         update_displayed_time, update_displayed_character_xp, 
         update_displayed_dialogue, update_displayed_textline_answer,
         start_activity_display, start_sleeping_display,
         create_new_skill_bar, update_displayed_skill_bar, update_displayed_skill_description,
         update_displayed_ongoing_activity, 
         update_enemy_attack_bar, update_character_attack_bar,
         update_displayed_location_choices,
         create_new_bestiary_entry,
         update_bestiary_entry,
         start_reading_display,
		 start_rereading_display,
		 start_location_action_display,
		 set_location_action_finish_text,
		 update_location_action_progress_bar,
		 update_location_action_finish_button,
         update_displayed_xp_bonuses, 
         update_displayed_skill_xp_gain, update_all_displayed_skills_xp_gain, update_displayed_stance_list, update_displayed_magic_list, update_displayed_stamina_efficiency, update_displayed_mana_efficiency, update_displayed_droprate, update_displayed_stance, update_displayed_faved_stances, update_stance_tooltip,
         update_gathering_tooltip,
         open_crafting_window,
         update_displayed_location_types,
         close_crafting_window,
         switch_crafting_recipes_page,
         switch_crafting_recipes_subpage,
         create_displayed_crafting_recipes,
         update_displayed_component_choice,
         update_displayed_material_choice,
         update_recipe_tooltip,
         update_displayed_crafting_recipes,
         update_item_recipe_visibility,
         update_item_recipe_tooltips,
         update_displayed_book,
         update_backup_load_button,
         update_other_save_load_button,
		 updateCombatDisplays, 
		 update_ally_attack_bar,
		 update_party_list,
		 populateQuestList,
		 addQuestAlertIfNeeded,
        } from "./display.js";
import { compare_game_version, get_hit_chance } from "./misc.js";
import { stances } from "./combat_stances.js";
import { magics } from "./magic.js";
import { get_recipe_xp_value, recipes } from "./crafting_recipes.js";
import { game_version, get_game_version } from "./game_version.js";
import { ActiveEffect, effect_templates} from "./active_effects.js";
import { allies} from "./allies.js";
import { quests} from "./quests.js";
import { Verify_Game_Objects } from "./verifier.js";

const save_key = "save data";
const dev_save_key = "dev save data";
const backup_key = "backup save";
const dev_backup_key = "dev backup save";

const global_flags = {
    is_gathering_unlocked: false,
    is_crafting_unlocked: false,
    is_deep_forest_beaten: false,
	is_chain_demon_beaten: false,
	is_saw_demon_beaten: false,
	is_ant_hive_beaten: false,
	is_rare_ant_killed: false,
	is_hero_level10: false,
	is_hero_level20: false,
	is_hero_level50: false,
	is_mining_level20: false,
	is_woodcutting_level20: false,
	is_herbalism_level20: false,
	is_fishing_level20: false,
	is_climbing_level10: false,
	is_swimming_level10: false,
	is_climbing_level20: false,
	is_swimming_level20: false,
	is_strength_train_level20: false,
	is_farming_level2: false,
	is_ahandling_level2: false,
};
const flag_unlock_texts = {
    is_gathering_unlocked: "You have gained the ability to gather new materials!",
    is_crafting_unlocked: "You have gained the ability to craft items and equipment!",
}

//in seconds
let total_playtime = 0;

let total_deaths = 0;
let total_suicides = 0;
let enviromental_deaths = 0;
let total_crafting_attempts = 0;
let total_crafting_successes = 0;
let total_kills = 0;
let tags_bonus = 1;
let type_bonus = 1;
let counter_chance = 0.05;
let grilled_goo_eaten = 0;

let gathered_materials = {};

//current enemy
let current_enemies = null;

const enemy_attack_loops = {};
let enemy_attack_cooldowns;
let enemy_timer_variance_accumulator = [];
let enemy_timer_adjustment = [];
let enemy_timers = [];
let character_attack_loop;

const ally_attack_loops = {};
let ally_attack_cooldowns;
let ally_timer_variance_accumulator = [];
let ally_timer_adjustment = [];
let ally_timers = [];

//current location
let current_location;
let ambient_damage_counter = 0;

let current_activity;

let visited_locations = [];

let location_action_interval;
let current_location_action;

//resting, true -> health regenerates
let is_resting = true;

//sleeping, true -> health regenerates, timer goes up faster
let is_sleeping = false;

let last_location_with_bed = null; //actually last location where player slept!
let last_combat_location = null;

//reading, either null or book name
let is_reading = null;
let is_rereading = null;

//ticks between saves, 60 = ~1 minute
let save_period = 60;
let save_counter = 0;

//ticks between saves, 60 = ~1 minute
let backup_period = 3600;
let backup_counter = 0;

//accumulates deviations
let time_variance_accumulator = 0;
//all 3 used for calculating and adjusting tick durations
let time_adjustment = 0;
let start_date;
let end_date;

let current_dialogue;
const active_effects = {};
//e.g. health regen from food

let selected_stance = "normal";
let current_stance = "normal";
const faved_stances = {};


let active_quests = [];
let finished_quests = [];

let hidden_skills =[];

const favourite_consumables = {};

let magic_cooldowns = {}; // { [magicId]: remainingTicks }

const tickrate = 1;
//how many ticks per second
//1 is the default value; going too high might make the game unstable

//stuff from options panel
const options = {
    uniform_text_size_in_action: false,
    auto_return_to_bed: true,
    remember_message_log_filters: true,
    remember_sorting_options: false,
    combat_disable_autoswitch: false,
    auto_use_when_longest_runs_out: true,
	log_total_gathering_gain: true,

};

let message_log_filters = {
    unlocks: true,
    events: true,
    combat: true,
    loot: true,
    crafting: true,
    background: true,
};

//enemy crit stats
const enemy_crit_chance = 0.1;
const enemy_crit_damage = 2; //multiplier, not a flat bonus

//character name
const name_field = document.getElementById("character_name_field");
name_field.value = character.name;
name_field.addEventListener("change", () => character.name = name_field.value.toString().trim().length>0?name_field.value:"Hero");

const current_party = [];

let global_battle_state = {
    "Titan Turtle": {
        hp: 100000,
    }
};/// note: currently this is updated when the location is cleared, not at point of damage. Which only matters if you save the game mid-fight after doing damage, then reload. 

const time_field = document.getElementById("time_div");
time_field.innerHTML = current_game_time.toString();

(function setup(){
    Object.keys(skills).forEach(skill => {
        character.xp_bonuses.total_multiplier[skill] = 1;
    });
})();

function option_uniform_textsize(option) {
    //doesn't really force same textsize, just changes some variables so they match
    const checkbox = document.getElementById("options_textsize");
    if(checkbox.checked || option) {
        options.uniform_text_size_in_action = true;    
        document.documentElement.style.setProperty('--options_action_textsize', '20px');
    } else {
        options.uniform_text_size_in_action = false;
        document.documentElement.style.setProperty('--options_action_textsize', '16px');
    }

    if(option) {
        checkbox.checked = option;
    }
}

function option_bed_return(option) {
    const checkbox = document.getElementById("options_bed_return");
    if(checkbox.checked || option) {
        options.auto_return_to_bed = true;
    } else {
        options.auto_return_to_bed = false;
    }

    if(option) {
        checkbox.checked = option;
    }
}

function option_remember_filters(option) {
    const checkbox = document.getElementById("options_save_messagelog_settings");
    if(checkbox.checked || option) {
        options.remember_message_log_filters = true;
    } else {
        options.remember_message_log_filters = false;
    }

    if(option) {
        checkbox.checked = option;

        if(message_log_filters.unlocks){
            document.documentElement.style.setProperty('--message_unlocks_display', 'inline-block');
        } else {
            document.documentElement.style.setProperty('--message_unlocks_display', 'none');
            document.getElementById("message_show_unlocks").classList.remove("active_selection_button");
        }

        if(message_log_filters.combat) {
            document.documentElement.style.setProperty('--message_combat_display', 'inline-block');
        } else {
            document.documentElement.style.setProperty('--message_combat_display', 'none');
            document.getElementById("message_show_combat").classList.remove("active_selection_button");
        }

        if(message_log_filters.events) {
            document.documentElement.style.setProperty('--message_events_display', 'inline-block');
        } else {
            document.documentElement.style.setProperty('--message_events_display', 'none');
            document.getElementById("message_show_events").classList.remove("active_selection_button");
        }

        if(message_log_filters.loot) {
            document.documentElement.style.setProperty('--message_loot_display', 'inline-block');
        } else {
            document.documentElement.style.setProperty('--message_loot_display', 'none');
            document.getElementById("message_show_loot").classList.remove("active_selection_button");
        }

        if(message_log_filters.crafting) {
            document.documentElement.style.setProperty('--message_crafting_display', 'inline-block');
        } else {
            document.documentElement.style.setProperty('--message_crafting_display', 'none');
            document.getElementById("message_show_crafting").classList.remove("active_selection_button");
        }

        if(message_log_filters.background) {
            document.documentElement.style.setProperty('--message_background_display', 'inline-block');
        } else {
            document.documentElement.style.setProperty('--message_background_display', 'none');
            document.getElementById("message_show_background").classList.remove("active_selection_button");
        }
    }
}

function option_combat_autoswitch(option) {
    const checkbox = document.getElementById("options_dont_autoswitch_to_combat");

    if(checkbox.checked || option) {
        options.disable_combat_autoswitch = true;
    } else {
        options.disable_combat_autoswitch = false;
    }

    if(option) {
        checkbox.checked = option;
    }
}

function roll_time_demon(location) {
	
	
	
    if (Math.random() < 0.01 && global_flags.is_hero_level10 == true) { // 1% 
		locations["Time Demon"].is_finished = false;
        location.connected_locations.push({
            location: locations["Time Demon"],
            custom_text: "Encounter the Time Demon"
        })
		log_message("A time demon appeared!");
    }
}

function roll_item_discovery(location) {
    if (Math.random() < 0.01) { // 1% 
	return
    }
}

function option_log_gathering_result(option) {
    const checkbox = document.getElementById("options_log_gathering_result");

    if(checkbox.checked || option) {
        options.log_total_gathering_gain = true;
    } else {
        options.log_total_gathering_gain = false;
    }

    if(option) {
        checkbox.checked = option;
    }
}


function change_location(location_name) {
    let location = locations[location_name];
	end_actions();
    if(location_name !== current_location?.name && location.is_finished) {
        return;
    }
	

    clear_all_enemy_attack_loops();
    clear_character_attack_loop();
	clear_all_ally_attack_loops();
    clear_enemies();

    if(!location) {
        throw `No such location as "${location_name}"`;
    }

    if(typeof current_location !== "undefined" && current_location.name !== location.name ) { 
        //so it's not called when initializing the location on page load or on reloading current location (due to new unlocks)
        log_message(`[ Entering ${location.name} ]`, "message_travel");
    }

    if(location.crafting) {
        update_displayed_crafting_recipes();
    }
    
    current_location = location;
	handle_location_visit(location);
	
    update_character_stats();

    if("connected_locations" in current_location) { 
        // basically means it's a normal location and not a combat zone (as combat zone has only "parent")
        roll_time_demon(current_location);
		roll_item_discovery(current_location);
		update_displayed_normal_location(current_location);
		updateCombatDisplays(0);//to turn off the allies display, possibly redunant after adding the right listener.
    } else { //so if entering combat zone
        update_displayed_combat_location(current_location);
        start_combat();
		if (current_party.length > 0) {
		updateCombatDisplays(current_party.length); // Pass the size instead of the array
		}

        if(!current_location.is_challenge) {
            last_combat_location = current_location.name;
        }
    }
	
	//console.log(location);  // enable for debugging purposes
	//console.log(visited_locations);
}

function handle_location_visit(location) {
    if (visited_locations.includes(location.name)) {
        // Already visited, do nothing special
        return;
    }
    // Mark as visited
    visited_locations.push(location.name);

    // Check for on_first_entry effects and handle them
    if (location.on_first_visit && Array.isArray(location.on_first_visit)) {
        execute_first_visit_effects(current_location.on_first_visit);
    }
}

// Location first vist effect executor function
function execute_first_visit_effects(on_first_visit) {
    if (!on_first_visit || on_first_visit.length === 0) return;

    for (const effect of on_first_visit) {
        switch (effect.type) {
            case "QuestStart":
                startQuest(effect.id);
                break;

            case "QuestUpdate":
                questUpdate(effect);
                break;

            case "TaskUpdate":
                // Placeholder for task update logic (to be implemented later)
                console.log("Task update not yet implemented:", effect);
                break;

            default:
                console.warn("Unknown effect type:", effect.type);
        }
    }
}


function startQuest(quest_id) {
    const quest = quests[quest_id];
	
	// Don't start quest if already active.
	if (active_quests.some(quest => quest.quest_id === quest_id)) {
    return;
	}
	
    // Don't start the quest if it's marked as finished.
    if (quest.is_finished) {
        console.log(`Quest "${quest_id}" is already finished. Not starting.`);
        return;
    }

    active_quests.push(quest);
	log_message(`Quest "${quest_id}" started.`,"quest_update");
	populateQuestList(active_quests);
	addQuestAlertIfNeeded();
}
	

 function    finishQuest(quest_index) {
        active_quests.splice(quest_index, 1);
    }


	
function questUpdate(effect) {
    const quest_id = effect.id;
	
	if (!active_quests.some(quest => quest.quest_id === quest_id)) {
    return;

}

    if (effect.completion === "y") {
        // Remove from active_quests (modify in place)
        for (let i = active_quests.length - 1; i >= 0; i--) {
            if (active_quests[i].quest_id === quest_id) {
                active_quests.splice(i, 1);
            }
        }

        // Mark quest as finished
        finished_quests.push(quest_id);
        quests[quest_id].is_finished = true;

        // Reward handling with quest_id passed for logging
        questRewardHandler(quests[quest_id].quest_rewards, quest_id);
    }

    populateQuestList(active_quests);
	addQuestAlertIfNeeded();
}

function questRewardHandler(rewards, quest_id) {
    if (!Array.isArray(rewards)) {
        rewards = [rewards]; // Convert single reward to array
    }

    for (const reward of rewards) {
        switch (reward.type) {
            case "hero_xp":
                log_message(`Gained +${reward.value} Hero XP from completing quest "${quest_id}"`,"quest_completed");
                add_xp_to_character(reward.value);
                break;

            case "skill_xp":
				log_message(`Gained +${reward.value} ${reward.skill} XP from completing quest "${quest_id}"`,"quest_completed");
                add_xp_to_skill({ skill: skills[reward.skill], xp_to_add: reward.value });
                break;

			case "item":
				let itemLogMessage = `Gained ${reward.item_name}`;
				if (reward.count && reward.count > 0) {
					itemLogMessage += ` x${reward.count}`;
				}
				itemLogMessage += ` from completing quest "${quest_id}"`;
				log_message(itemLogMessage, "quest_completed");
				parse_quest_rewards(reward);
				break;

			 default:
				if (reward.type.startsWith("dummy_")) {
					log_message(`Gained +50 Hero XP from completing quest "${quest_id}"`,"quest_completed");
					add_xp_to_character(50);
					console.log(`Skipping dummy reward type "${reward.type}" in quest "${quest_id}"`);
					break;
				}
				console.warn(`Unknown reward type "${reward.type}" in quest "${quest_id}"`);

        }
    }
}


function parse_quest_rewards(quest_rewards) {
const parsed_items = [];

if (!Array.isArray(quest_rewards)) {
	quest_rewards = [quest_rewards];
}

for (const reward of quest_rewards) {
	if (reward.type !== "item") continue;

	const item_key = typeof reward === "string" ? reward : reward.item_name;
	const count = reward.count ?? 1;
	const item_template = item_templates[item_key];

	if (!item_template) {
		console.warn(`Item template not found for key: ${item_key}`);
		continue;
	}

	let final_count = count;
	if (Array.isArray(final_count)) {
		final_count = get_random_int(final_count[0], final_count[1]);
	}

	log_message(`${character.name} obtained "${item_template.getName()} x${final_count}"`);

	parsed_items.push({
		item: item_template,
		count: final_count
	});
}

add_to_character_inventory(parsed_items);
}

// Utility function
function get_random_int(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}
/**
 * 
 * @param {String} location_name 
 * @returns {Boolean} if there's anything that can be unlocked by clearing it
 */
/*
function does_location_have_available_unlocks(location_name) {
    //include dialogue lines
    if(!locations[location_name]) {
        throw new Error(`No such location as "${location_name}"`);
    }
    let does = false;
    
    Object.keys(locations[location_name].repeatable_reward).forEach(reward_type_key => {
        if(does) {
            return;
        }
        if(reward_type_key === "textlines") {
            Object.keys(locations[location_name].repeatable_reward[reward_type_key]).forEach(textline_unlock => {
                if(does) {
                    return;
                }
                const {dialogue, lines} = locations[location_name].repeatable_reward[reward_type_key][textline_unlock];
                for(let i = 0; i < lines.length; i++) {
                    if(!dialogues[dialogue].textlines[lines[i]].is_unlocked) {
                        does = true;
                    }
                }
            });
        }

        if(reward_type_key === "locations") {
            Object.keys(locations[location_name].repeatable_reward[reward_type_key]).forEach(location_unlock => {
                if(does) {
                    return;
                }
                locations[location_name].repeatable_reward[reward_type_key][location_unlock];
                for(let i = 0; i < locations[location_name].repeatable_reward[reward_type_key][location_unlock].length; i++) {
                    const location_key = locations[location_name].repeatable_reward[reward_type_key][location_unlock][i].location;
                    if(!locations[location_key].is_unlocked) {
                        does = true;
                    }
                }
            });
        }

        if(reward_type_key === "activities") {
            //todo: additionally need to check if gathering is unlocked (if its a gathering activity) 
            Object.keys(locations[location_name].repeatable_reward[reward_type_key]).forEach(activity_unlock => {
                if(does) {
                    return;
                }

                for(let i = 0; i < locations[location_name].repeatable_reward[reward_type_key][activity_unlock].length; i++) {
                    const {location, activity} = locations[location_name].repeatable_reward[reward_type_key][activity_unlock][i];
                    if(!locations[location].activities[activity].is_unlocked) {
                        does = true;
                    }
                }
            });
        }

    });
}
*/
/**
 * 
 * @param {String} location_name 
 * @returns {Boolean} if there's something that can be unlocked by clearing it after additional conditions are met
 */
/*
function does_location_have_unavailable_unlocks(location_name) {

    if(!locations[location_name]) {
        throw new Error(`No such location as "${location_name}"`);
    }
    let does = false;
}
*/
/**
 * 
 * @param {Object} selected_activity - {id} of activity in Location's activities list??
 */
function start_activity(selected_activity) {
    current_activity = Object.assign({},current_location.activities[selected_activity]);
    current_activity.id = selected_activity;

    if(!activities[current_activity.activity_name]) {
        throw `No such activity as ${current_activity.activity_name} could be found`;
    }

    if(activities[current_activity.activity_name].type === "JOB") {
        if(!can_work(current_activity)) {
            current_activity = null;
            return;
        }

        current_activity.earnings = 0;
        current_activity.working_time = 0;

    } else if(activities[current_activity.activity_name].type === "TRAINING") {
        //
    } else if(activities[current_activity.activity_name].type === "GATHERING") { 
        
        let has_proper_tool = !activities[current_activity.activity_name].required_tool_type || character.equipment[activities[current_activity.activity_name].required_tool_type];
        //just check if slot is not empty

        if(!has_proper_tool) {
            log_message("You need to equip a proper tool to do that!");
            current_activity = null;
            return;
        }
        current_activity.gathered_materials = {};
    } else throw `"${activities[current_activity.activity_name].type}" is not a valid activity type!`;

    current_activity.gathering_time = 0;
    if(current_activity.gained_resources) {
        current_activity.gathering_time_needed = current_activity.getActivityEfficiency().gathering_time_needed;
    }

    start_activity_display(current_activity);
}

function end_activity() {
    
    log_message(`${character.name} finished ${current_activity.activity_name}`, "activity_finished");

    
    if(current_activity.earnings) {
        log_message(`${character.name} earned ${format_money(current_activity.earnings)}`, "activity_money");
        add_money_to_character(current_activity.earnings);
    }

    if(current_activity.gathered_materials && options.log_total_gathering_gain) {
	
        const loot = []; 
		
		
			 Object.keys(current_activity.gathered_materials).forEach(mat_key => {
			loot.push({ item_id: mat_key, count: current_activity.gathered_materials[mat_key] });
		});

		log_loot({ loot_list: loot, is_a_summary: true }); 
    }
    end_activity_animation(); //clears the "animation"
    current_activity = null;
    change_location(current_location.id);
}

/**
 * @description Unlocks an activity and adds a proper message to the message log. NOT called on loading a save.
 * @param {Object} activity_data {activity, location_name}
 */
 function unlock_activity(activity_data) {
    if(!activity_data.activity.is_unlocked){
        activity_data.activity.is_unlocked = true;
        
        let message = "";
        if(locations[activity_data.location].activities[activity_data.activity.activity_name].unlock_text) {
           message = locations[activity_data.location].activities[activity_data.activity.activity_name].unlock_text+":<br>";
        }
        log_message(message + `Unlocked activity "${activity_data.activity.activity_name}" in location "${activity_data.location}"`, "activity_unlocked");
    }
}

/**
 * Starts selected action, checks conditions if applicable, launches action animations
 * @param {*} selected_action 
 * @returns 
 */
function start_location_action(selected_action) {
    current_location_action = selected_action;
    const location_action = current_location.actions[selected_action];
    let conditions_status; //[0,...,1]

    start_location_action_display(selected_action);
	
	if(location_action.start_quests){
		for(let i = 0; i < location_action.start_quests.length; i++) { //starts quests
        startQuest(location_action.start_quests[i]);
    }
	}

    if(!location_action.can_be_started(character)) {
        finish_location_action(selected_action, -1);
        return;
    }
    
    if(!location_action.check_conditions_on_finish) {
        conditions_status = location_action.get_conditions_status(character);

        if(conditions_status == 0) {
            finish_location_action(selected_action, 0);
            return;
        }
    }

    if(location_action.attempt_duration > 0) {
        let current_iterations = 0;
        const total_iterations = location_action.attempt_duration/0.1;

        location_action_interval = setInterval(()=>{
            if(current_iterations >= total_iterations - 1) {
                clearInterval(location_action_interval);
                finish_location_action(selected_action, conditions_status);
            }

            current_iterations++;
            update_location_action_progress_bar(current_iterations/total_iterations);
        }, 1000*0.1/tickrate);
    } else {
        finish_location_action(selected_action, conditions_status);
        update_location_action_progress_bar(1);
    }
}

/**
 * Handles the finish, successful or not, of a location action. Not to be mistaken for end_location_action
 * @param {String} selected_action 
 * @param {Number} conditions_status
 */
function finish_location_action(selected_action, conditions_status){
    end_activity_animation(true);

    const action = current_location.actions[selected_action];

    if(typeof conditions_status === 'undefined') {
        conditions_status = current_location.actions[selected_action].get_conditions_status(character);
    }
    
    let result_message = 'If you see this, Miktaew screwed something up. Whoops!';

    if(conditions_status == -1) {
        //not meeting requirements to begin
        result_message = action.failure_texts.unable_to_begin[Math.floor(action.failure_texts.unable_to_begin.length * Math.random())];
    } else if(conditions_status == 0) {
        //lost by failing to meet conditions, nothing to check, deal with it
        result_message = action.failure_texts.conditional_loss[Math.floor(action.failure_texts.conditional_loss.length * Math.random())];
    } else {
        const action_result = get_location_action_result(selected_action, conditions_status);
        let is_won = false;
        if(action_result > Math.random()) {
            //win

            result_message = action.success_text;
            action.is_finished = true;
            process_rewards({rewards: action.rewards, source_type: "action"});
            is_won = true;
        } else {
            //random loss

            result_message = action.failure_texts.random_loss[Math.floor(action.failure_texts.random_loss.length * Math.random())];
			process_rewards({rewards: action.loss_rewards, source_type: "action"});
        }

        Object.keys(action.conditions[0]?.items_by_id || {}).forEach(item_id => {
            //no need to check if they are in inventory, as without them action would have been conditionally failed before reaching here
            if(action.conditions[0].items_by_id[item_id].remove) {
                remove_from_character_inventory([{item_key: item_templates[item_id].getInventoryKey(), item_count: action.conditions[0].items_by_id[item_id].count}]);
            }
        });
        Object.keys(action.required.items_by_id || {}).forEach(item_id => {
            //again no need to check
            if(action.required.items_by_id[item_id].remove_on_success && is_won || action.required.items_by_id[item_id].remove_on_fail && !is_won) {
                remove_from_character_inventory([{item_key: item_templates[item_id].getInventoryKey(), item_count: action.required.items_by_id[item_id].count}]);
            }
        });
    }

    set_location_action_finish_text(result_message);
    update_location_action_finish_button();
}

/**
 * Handles giving up / leaving after success from a location action. Not to be mistaken for finish_location_action
 */
function end_location_action() {
    end_activity_animation();
    clearInterval(location_action_interval);
    current_location_action = null;
    change_location(current_location.id);
}



/**
 * 
 * @param {String} selected_action 
 * @param {Number} conditions_status assumed to be more than 0
 * @returns {Boolean} did_succeed
 */
function get_location_action_result(selected_action, conditions_status) {
    const action = current_location.actions[selected_action];

    if(action.success_chances.length == 1) {
        return action.success_chances[0];
    } else if(conditions_status == 1 && action.success_chances[1]) {
        return action.success_chances[1];
    } else {
        return action.success_chances[0] + (action.success_chances[1]-action.success_chances[0]) * conditions_status;
    }
}
//generic rewards handler used in the dev version. Copied for use with location actions, but keeping it around may help with some cross compatibility.
function process_rewards({rewards = {}, source_type, source_name, is_first_clear, inform_overall = true, inform_textline = true, only_unlocks = false}) {
    if(rewards.money && typeof rewards.money === "number" && !only_unlocks) {
        if(inform_overall) {
            log_message(`${character.name} earned ${format_money(rewards.money)}`);
        }
        add_money_to_character(rewards.money);
    }

    if(rewards.xp && typeof rewards.xp === "number" && !only_unlocks) {
        if(source_type === "location") {
            if(inform_overall) {
                if(is_first_clear) {
                    log_message(`Obtained ${rewards.xp}xp for clearing ${source_name} for the first time`, "location_reward");
                } else {
                    log_message(`Obtained additional ${rewards.xp}xp for clearing ${source_name}`, "location_reward");
                }
            }
        } else {
            //other sources
        }
        add_xp_to_character(rewards.xp);
    }

    if(rewards.skill_xp && !only_unlocks) {
        Object.keys(rewards.skill_xp).forEach(skill_key => {
            if(typeof rewards.skill_xp[skill_key] === "number") {
                if(inform_overall) {
                    log_message(`${character.name} gained ${rewards.skill_xp[skill_key]}xp to ${skills[skill_key].name()}`);
                }
                add_xp_to_skill({skill: skills[skill_key], xp_to_add: rewards.skill_xp[skill_key]});
            }
        });
    }
    
if (rewards.locations) {
    for (let i = 0; i < rewards.locations.length; i++) {
        const loc_id = rewards.locations[i].location;
        const skip_msg = rewards.locations[i].skip_message;

        // Modify the location object temporarily to attach skip_message logic
        const loc = locations[loc_id];

        if (inform_overall && skip_msg) {
            // Temporarily add unlock_text as empty to suppress message
            const original_text = loc.unlock_text;
            loc.unlock_text = ""; // Will suppress the message inside unlock_location
            unlock_location(loc);
            loc.unlock_text = original_text; // Restore original text
        } else {
            unlock_location(loc);
        }
    }
}

    if(rewards.flags) {
        for(let i = 0; i < rewards.flags.length; i++) {
            const flag = global_flags[rewards.flags[i]];
            global_flags[rewards.flags[i]] = true;
            if(!flag && flag_unlock_texts[rewards.flags[i]] && inform_overall) {
                log_message(`${flag_unlock_texts[rewards.flags[i]]}`, "activity_unlocked");
            }
        }
    }

    if(rewards.textlines) {
        for(let i = 0; i < rewards.textlines.length; i++) {
            let any_unlocked = false;
            for(let j = 0; j < rewards.textlines[i].lines.length; j++) {
                if(dialogues[rewards.textlines[i].dialogue].textlines[rewards.textlines[i].lines[j]].is_unlocked == false) {
                    any_unlocked = true;
                    dialogues[rewards.textlines[i].dialogue].textlines[rewards.textlines[i].lines[j]].is_unlocked = true;
                }
            }
            if(any_unlocked && inform_textline && inform_overall) {
                log_message(`You should talk to ${rewards.textlines[i].dialogue}`, "dialogue_unlocked");
                //maybe do this only when there's just 1 dialogue with changes?
            }
        }
    }

    if(rewards.dialogues) {
        for(let i = 0; i < rewards.dialogues?.length; i++) {
            const dialogue = dialogues[rewards.dialogues[i]]
            if(!dialogue.is_unlocked) {
                dialogue.is_unlocked = true;
                log_message(`You can now talk with ${dialogue.name}`, "activity_unlocked");
            }
        }
    }

    if(rewards.traders) { 
        for(let i = 0; i < rewards.traders.length; i++) {
            const trader = traders[rewards.traders[i].trader];
            if(!trader.is_unlocked) {
                trader.is_unlocked = true;
                if(!rewards.traders[i].skip_message) {
                    log_message(`You can now trade with ${trader.name}`, "activity_unlocked");
                }
            }
        }
    }

    if(rewards.activities) {
        for(let i = 0; i < rewards.activities?.length; i++) {
            if(!locations[rewards.activities[i].location].activities[rewards.activities[i].activity].tags?.gathering || global_flags.is_gathering_unlocked) {

                unlock_activity({location: locations[rewards.activities[i].location].name, 
                                activity: locations[rewards.activities[i].location].activities[rewards.activities[i].activity]});

            }
        }
    }

    if(rewards.actions) {
        for(let i = 0; i < rewards.actions?.length; i++) {
            unlock_action({
                location: locations[rewards.actions[i].location].name, 
                action: locations[rewards.actions[i].location].actions[rewards.actions[i].action]
            });
        }
    }

    if(rewards.stances) {  
        for(let i = 0; i < rewards.stances.length; i++) {
            unlock_combat_stance(rewards.stances[i]);
        }
    }

    if(rewards.skills) {
        for(let i = 0; i < rewards.skills.length; i++) {
            if(!skills[rewards.skills[i]].is_unlocked) {
                skills[rewards.skills[i]].is_unlocked = true;
                create_new_skill_bar(skills[rewards.skills[i]]);
                update_displayed_skill_bar(skills[rewards.skills[i]], false);
                if(inform_overall) {
                    log_message(`Unlocked new skill: ${skills[rewards.skills[i]].name()}`);
                }

                if(source_type === "skill") {
                    if(!which_skills_affect_skill[rewards.skills[i]]) {
                        which_skills_affect_skill[rewards.skills[i]] = [];
                    }

                    if(skills[source_name]) {
                        which_skills_affect_skill[rewards.skills[i]].push(source_name);
                    } else {
                        console.error(`Tried to register skill "${source_name}" as related to "${rewards.skills[i]}", but the former does not exist!`);
                    }
                }

                //update all related skills; may be none if unlock was not from another skill, so need to check with '?'
                for(let j = 0; j < which_skills_affect_skill[rewards.skills[i]]?.length; j++) {
                    update_displayed_skill_bar(skills[which_skills_affect_skill[rewards.skills[i]][j]], false);
                }
            }
        }
    }

    if(rewards.recipes) {
        for(let i = 0; i < rewards.recipes.length; i++) {
            if(!recipes[rewards.recipes[i].category][rewards.recipes[i].subcategory][rewards.recipes[i].recipe_id].is_unlocked) {
                recipes[rewards.recipes[i].category][rewards.recipes[i].subcategory][rewards.recipes[i].recipe_id].is_unlocked = true;
                if(inform_overall) {
                    log_message(`Unlocked new recipe: ${recipes[rewards.recipes[i].category][rewards.recipes[i].subcategory][rewards.recipes[i].recipe_id].name}`);
                }
            }
        }
    }

    if(rewards.locks) {
        if(rewards.locks.textlines) {
            Object.keys(rewards.locks.textlines).forEach(dialogue_key => {
                for(let i = 0; i < rewards.locks.textlines[dialogue_key].length; i++) {
                    dialogues[dialogue_key].textlines[rewards.locks.textlines[dialogue_key][i]].is_finished = true;
                }
            });
        }
        if(rewards.locks.locations) {
            for(let i = 0; i < rewards.locks.locations.length; i++) {
                lock_location({location: locations[rewards.locks.locations[i]]});
            }
        }
        if(rewards.locks.traders) {
            for(let i = 0; i < rewards.locks.traders.length; i++) {
                traders[rewards.locks.traders[i]].is_finished = true;
            }
        }
    }

			if (rewards.items && !only_unlocks) {
			

				const parsed_items = [];

				for (let i = 0; i < rewards.items.length; i++) {
					const reward_entry = rewards.items[i];
					const item_key = typeof reward_entry === "string" ? reward_entry : reward_entry.item;
					const count = reward_entry.count || 1;

					const item = item_templates[item_key];

					if (!item) {
						console.warn(`Item template not found for key: ${item_key}`);
						continue;
					}

					log_message(`${character.name} obtained "${item.getName()} x${count}"`);

					parsed_items.push({
						item: item,
						count: count
					});
				}

				add_to_character_inventory(parsed_items);
			}

    if(rewards.reputation && !only_unlocks) {
        Object.keys(rewards.reputation).forEach(region => {
            ReputationManager.add_reputation({region, reputation: rewards.reputation[region]});
        });
    }

    if(rewards.move_to && !only_unlocks) {
        if(source_type !== "action") {
            change_location[rewards.move_to.location];
        } else {
            current_location = locations[rewards.move_to.location];
        }
    }
}
function add_money_to_character(money_num) {
    character.money += money_num;
    update_displayed_money();
}

//single tick of resting
function do_resting() {
    if(character.stats.full.health < character.stats.full.max_health)
    {
        const resting_heal_ammount = Math.max(character.stats.full.max_health * 0.01,2); 
        //todo: scale it with skill, because why not?; maybe up to x2 bonus

        character.stats.full.health += (resting_heal_ammount);
        if(character.stats.full.health > character.stats.full.max_health) {
            character.stats.full.health = character.stats.full.max_health;
        } 
        update_displayed_health();
    }

    if(character.stats.full.stamina < character.stats.full.max_stamina)
    {
        const resting_stamina_ammount = Math.round(Math.max(character.stats.full.max_stamina/120, 2)); 
        //todo: scale it with skill as well

        character.stats.full.stamina += (resting_stamina_ammount);
        if(character.stats.full.stamina > character.stats.full.max_stamina) {
            character.stats.full.stamina = character.stats.full.max_stamina;
        } 
        
        update_displayed_stamina();
    }

    if(character.stats.full.mana < character.stats.full.max_mana)
    {
        const resting_mana_ammount = Math.round(Math.max(character.stats.full.max_mana/120, 2)); 
        //todo: scale it with skill as well

        character.stats.full.mana += (resting_mana_ammount);
        if(character.stats.full.mana > character.stats.full.max_mana) {
            character.stats.full.mana = character.stats.full.max_mana;
        } 
        
        update_displayed_mana();
    }
}

function do_sleeping() {
    if(character.stats.full.health < character.stats.full.max_health)
    {
        const sleeping_heal_ammount = Math.round(Math.max(character.stats.full.max_health * 0.04, 5) * (1 + skills["Sleeping"].current_level/skills["Sleeping"].max_level));
        
        character.stats.full.health += (sleeping_heal_ammount);
        if(character.stats.full.health > character.stats.full.max_health) {
            character.stats.full.health = character.stats.full.max_health;
        } 
        update_displayed_health();
    }

    if(character.stats.full.stamina < character.stats.full.max_stamina)
    {
        const sleeping_stamina_ammount = Math.round(Math.max(character.stats.full.max_stamina/30, 5) * (1 + skills["Sleeping"].current_level/skills["Sleeping"].max_level)); 
        //todo: scale it with skill as well

        character.stats.full.stamina += (sleeping_stamina_ammount);
        if(character.stats.full.stamina > character.stats.full.max_stamina) {
            character.stats.full.stamina = character.stats.full.max_stamina;
        } 
        update_displayed_stamina();
    }
	
    if(character.stats.full.mana < character.stats.full.max_mana)
    {
        const sleeping_mana_ammount = Math.round(Math.max(character.stats.full.max_mana/30, 5) * (1 + skills["Sleeping"].current_level/skills["Sleeping"].max_level)); 
        //todo: scale it with skill as well

        character.stats.full.mana += (sleeping_mana_ammount);
        if(character.stats.full.mana > character.stats.full.max_mana) {
            character.stats.full.mana = character.stats.full.max_mana;
        } 
        update_displayed_mana();
    }
}

function start_sleeping() {
    start_sleeping_display();
    is_sleeping = true;

    last_location_with_bed = current_location.name;
}

function end_sleeping() {
    is_sleeping = false;
    change_location(current_location.name);
    end_activity_animation();
}


function end_actions(){
    if(is_reading) {
        end_reading;
    } 
    if(is_rereading) {
        end_rereading;
    } 

    if(is_sleeping) {
        end_sleeping;
    }
    if(current_activity) {
        end_activity(current_activity);
    }
	
	
}

function start_reading(book_key) {
    const book_id = JSON.parse(book_key).id;
    if(locations[current_location]?.parent_location) {
        return; //no reading in combat areas
    }

    if(is_reading === book_id) {
        end_reading();
        return; 
        //reading the same one, cancel
    } else if(is_reading) {
        end_reading();
    }

    if(book_stats[book_id].is_finished) {
        re_reading(book_id);
		return; //already read
    }

    if(is_sleeping) {
        end_sleeping();
    }
    if(current_activity) {
        end_activity();
    }


    is_reading = book_id;
    start_reading_display(book_id);

    update_displayed_book(is_reading);
}

function end_reading() {
    change_location(current_location.name);
    end_activity_animation();
    
    const book_id = is_reading;
    is_reading = null;

    update_displayed_book(book_id);
}

function end_rereading() {
    change_location(current_location.name);
    end_activity_animation();
    
    const book_id = is_rereading;
    is_rereading = null;

    update_displayed_book(book_id);
}

function re_reading(book_id) {
	is_rereading = book_id;
	start_rereading_display(book_id);
    update_displayed_book(is_rereading);
}

function do_reading() {
    item_templates[is_reading].addProgress();

    update_displayed_book(is_reading);

    add_xp_to_skill({skill: skills["Literacy"], xp_to_add: book_stats.literacy_xp_rate});
    if(book_stats[is_reading].is_finished) {
        log_message(`Finished the book "${is_reading}"`);
        end_reading();
        update_character_stats();
    }
}

function do_rereading() {
    const book = book_stats[is_rereading];

    // XP from base rereading
    add_xp_to_skill({skill: skills["Literacy"], xp_to_add: book.literacy_xp_rate * 0.1});

    // Increase accumulated time
    book.accumulated_time++;

    // Check for multiple of required_time
    if (book.accumulated_time % book.required_time === 0) {
        const rewards = book.repeat_rewards || {};

        if (rewards.xp) {
            for (const [skillName, xpAmount] of Object.entries(rewards.xp)) {
                if (skills[skillName]) {
                    add_xp_to_skill({skill: skills[skillName], xp_to_add: xpAmount});
                    log_message(`Gained ${xpAmount} XP in ${skillName} from rereading "${is_rereading}"`);
                }
            }
        }

        // Extend if you want to repeat other kinds of rewards here
    }

    update_displayed_book(is_rereading);
}



function get_current_book() {
    return is_reading;
}

/**
 * 
 * @param {*} selected_job location job property
 * @returns if current time is within working hours
 */
function can_work(selected_job) {
    //if can start at all
    if(!selected_job.infinite) {
        if(selected_job.availability_time.end > selected_job.availability_time.start) {
            //ends on the same day
            if(current_game_time.hour * 60 + current_game_time.minute > selected_job.availability_time.end*60
                ||  //too late
                current_game_time.hour * 60 + current_game_time.minute < selected_job.availability_time.start*60
                ) {  //too early
                
                return false;
            }
        } else {
            //ends on the next day (i.e. working through the night)        
            if(current_game_time.hour * 60 + current_game_time.minute > selected_job.availability_time.start*60
                //too late
                ||
                current_game_time.hour * 60 + current_game_time.minute < selected_job.availability_time.end*60
                //too early

            ) {  
                return false;
            }
        }
    }

    return true;
}

/**
 * 
 * @param {} selected_job location job property
 * @returns if there's enough time to earn anything
 */
function enough_time_for_earnings(selected_job) {

    if(!selected_job.infinite) {
        //if enough time for at least 1 working period
        if(selected_job.availability_time.end > selected_job.availability_time.start) {
            //ends on the same day
            if(current_game_time.hour * 60 + current_game_time.minute + selected_job.working_period - selected_job.working_time%selected_job.working_period > selected_job.availability_time.end*60
                ||  //not enough time left for another work period
                current_game_time.hour * 60 + current_game_time.minute < selected_job.availability_time.start*60
                ) {  //too early to start (shouldn't be allowed to start and get here at all)
                return false;
            }
        } else {
            //ends on the next day (i.e. working through the night)        
            if(current_game_time.hour * 60 + current_game_time.minute > selected_job.availability_time.start*60
                //timer is past the starting hour, so it's the same day as job starts
                && 
                current_game_time.hour * 60 + current_game_time.minute + selected_job.working_period  - selected_job.working_time%selected_job.working_period > selected_job.availability_time.end*60 + 24*60
                //time available on this day + time available on next day are less than time needed
                ||
                current_game_time.hour * 60 + current_game_time.minute < selected_job.availability_time.start*60
                //timer is less than the starting hour, so it's the next day
                &&
                current_game_time.hour * 60 + current_game_time.minute + selected_job.working_period  - selected_job.working_time%selected_job.working_period > selected_job.availability_time.end*60
                //time left on this day is not enough to finish
                ) {  
                return false;
            }
        }
    }

    return true;
}

/**
 * 
 * @param {String} dialogue_key 
 */
 
 function dialogueHasValidTextlines(dialogue) {
    return Object.values(dialogue.textlines).some(textline => {
        if (!textline.is_unlocked || textline.is_finished) return false;

        const flags = textline.required_flags;
        if (flags) {
            if (flags.yes) {
                if (!Array.isArray(flags.yes)) {
                    console.error(`required_flags.yes should be an array`);
                    return false;
                }
                for (let flag of flags.yes) {
                    if (!global_flags[flag]) return false;
                }
            }
            if (flags.no) {
                if (!Array.isArray(flags.no)) {
                    console.error(`required_flags.no should be an array`);
                    return false;
                }
                for (let flag of flags.no) {
                    if (global_flags[flag]) return false;
                }
            }
        }

        return true;
    });
}

function start_dialogue(dialogue_key) {
    current_dialogue = dialogue_key;

    update_displayed_dialogue(dialogue_key);
}

function end_dialogue() {
    current_dialogue = null;
    reload_normal_location();
}
function reload_normal_location() {
    update_displayed_normal_location(current_location);
}

/**
 * 
 * @param {String} textline_key 
 */
function start_textline(textline_key){
    const dialogue = dialogues[current_dialogue];
    const textline = dialogue.textlines[textline_key];
	

if (
    textline.requires_items &&
    typeof textline.requires_items === 'object' &&
    textline.requires_items.item_template_key &&
    typeof textline.requires_items.quantity === 'number' &&
    textline.requires_items.quantity > 0
) {
    const { item_template_key, quantity } = textline.requires_items;
    const success = consume_items_if_available(item_template_key, quantity);
    if (!success) {
        log_message("You don't have enough items to proceed.", "warning");
        return;
    }
}


    for(let i = 0; i < textline.unlocks.flags.length; i++) {
        const flag = global_flags[textline.unlocks.flags[i]];
        if(!flag) {
            global_flags[textline.unlocks.flags[i]] = true;
            log_message(`${flag_unlock_texts[textline.unlocks.flags[i]]}`, "activity_unlocked");
        }
    }

		for (let i = 0; i < textline.unlocks.items.length; i++) {
			const entry = textline.unlocks.items[i];
			let itemName, count, quality;

			if (typeof entry === "string") {
				itemName = entry;
				count = 1;
				quality = undefined;
			} else {
				itemName = entry.name;
				count = entry.count || 1;
				quality = entry.quality; // optional
			}

			const baseTemplate = item_templates[itemName];
			if (!baseTemplate) {
				console.warn(`Item "${itemName}" not found in templates.`);
				continue;
			}

			log_message(`${character.name} obtained "${baseTemplate.getName()}" x${count}${quality ? ` (Quality: ${quality})` : ''}`);

			const itemsToAdd = [];
			for (let j = 0; j < count; j++) {
				const itemData = quality != null 
					? getItem({ ...baseTemplate, quality }) 
					: getItem({ ...baseTemplate });
				itemsToAdd.push({ item: itemData });
			}

			add_to_character_inventory(itemsToAdd);
		}

    if(textline.unlocks.money && typeof textline.unlocks.money === "number") {
        character.money += textline.unlocks.money;
        log_message(`${character.name} earned ${format_money(textline.unlocks.money)}`);
        update_displayed_money();
    }

    for(let i = 0; i < textline.unlocks.dialogues.length; i++) { //unlocking dialogues
        const dialogue = dialogues[textline.unlocks.dialogues[i]];
        if(!dialogue.is_unlocked) {
            dialogue.is_unlocked = true;
            log_message(`You can now talk with the ${dialogue.name}`, "activity_unlocked");
        }
    }

    for(let i = 0; i < textline.unlocks.traders.length; i++) { //unlocking traders
        const trader = traders[textline.unlocks.traders[i]];
        if(!trader.is_unlocked) {
            trader.is_unlocked = true;
            log_message(`You can now trade with ${trader.name}`, "activity_unlocked");
        }
    }

    for(let i = 0; i < textline.unlocks.textlines.length; i++) { //unlocking textlines
        const dialogue_name = textline.unlocks.textlines[i].dialogue;
        for(let j = 0; j < textline.unlocks.textlines[i].lines.length; j++) {
            dialogues[dialogue_name].textlines[textline.unlocks.textlines[i].lines[j]].is_unlocked = true;
        }
    }

    for(let i = 0; i < textline.unlocks.locations.length; i++) { //unlocking locations
        unlock_location(locations[textline.unlocks.locations[i]]);
    }

    for(let i = 0; i < textline.unlocks.stances.length; i++) { //unlocking stances
        unlock_combat_stance(textline.unlocks.stances[i]);
    }

	    for(let i = 0; i < textline.unlocks.magic.length; i++) { //unlocking magic
        unlock_magic(textline.unlocks.magic[i]);
    }
	
	for(let i = 0; i < textline.unlocks.allies.length; i++) { //unlocking allies
        add_allies_to_party(textline.unlocks.allies[i]);
    }
		for(let i = 0; i < textline.unlocks.expels.length; i++) { //expels allies
        remove_allies_from_party(textline.unlocks.expels[i]);
    }

		for(let i = 0; i < textline.unlocks.start_quests.length; i++) { //starts quests
        startQuest(textline.unlocks.start_quests[i]);
    }
	
			for(let i = 0; i < textline.unlocks.update_quests.length; i++) { //starts quests
        questUpdate(textline.unlocks.update_quests[i]);
    }
	
	//handle special actions
	if (textline.unlocks.special) {
    for (let i = 0; i < textline.unlocks.special.length; i++) {
        const specialAction = textline.unlocks.special[i];
        
        switch (specialAction.type) {
            case "remove_visit_flag":
                // Remove the target from visited_locations if it exists
                const index = visited_locations.indexOf(specialAction.target);
                if (index !== -1) {
                    visited_locations.splice(index, 1);
                }
                break;
            // Add more cases for other special action types as needed
            default:
                console.warn(`Unknown special action type: ${specialAction.type}`);
                break;
        }
    }
}
	
	
    for(let i = 0; i < textline.locks_lines.length; i++) { //locking textlines
        dialogue.textlines[textline.locks_lines[i]].is_finished = true;
    }

    if(textline.unlocks.activities) { //unlocking activities
        for(let i = 0; i < textline.unlocks.activities.length; i++) { //unlock 
            unlock_activity({location: locations[textline.unlocks.activities[i].location].name, 
                             activity: locations[textline.unlocks.activities[i].location].activities[textline.unlocks.activities[i].activity]});
        }
    }
    if(textline.otherUnlocks) {
        textline.otherUnlocks();
    }

    start_dialogue(current_dialogue);
    update_displayed_textline_answer(textline.text);
}

/**
 * @description Checks if character has the required quantity of an item and removes them if present.
 * @param {String} item_template_key - Key from item_templates
 * @param {Number} required_quantity - Quantity needed
 * @returns {Boolean} - True if the items were successfully removed, false otherwise
 */
function consume_items_if_available(item_template_key, required_quantity) {
    const item = item_templates[item_template_key];
    if (!item) {
        console.warn(`Item "${item_template_key}" not found.`);
        return false;
    }

    let totalAvailable = 0;
    const matchingKeys = [];

    // Gather matching inventory keys and count total available
    for (let key in character.inventory) {
        const invItem = character.inventory[key];
        if (invItem.item.id === item_template_key) {
            totalAvailable += invItem.count;
            matchingKeys.push({ key, count: invItem.count });
        }
    }

    if (totalAvailable < required_quantity) {
        return false;
    }

    // Prepare items to remove
    let toRemove = required_quantity;
    const removalList = [];

    for (let entry of matchingKeys) {
        const removeCount = Math.min(toRemove, entry.count);
        removalList.push({ item_key: entry.key, item_count: removeCount });
        toRemove -= removeCount;
        if (toRemove <= 0) break;
    }

    character.remove_from_inventory(removalList);
    update_displayed_character_inventory();
	
    return true;
}

function unlock_combat_stance(stance_id) {
    if(!stances[stance_id]) {
        console.warn(`Tried to unlock stance "${stance_id}", but no such stance exists!`);
        return;
    }
	
	  if(stances[stance_id].is_unlocked != true) {
    stances[stance_id].is_unlocked = true;
    update_displayed_stance_list();
    log_message(`You have learned a new stance: "${stances[stance_id].name}"`, "location_unlocked") 
        return;
    }
}




function change_stance(stance_id, is_temporary = false) {
    if(is_temporary) {
        if(!stances[stance_id]) {
            throw new Error(`No such stance as "${stance_id}"`);
        }
        if(!stances[stance_id].is_unlocked) {
            throw new Error(`Stance "${stance_id}" is not yet unlocked!`)
        }

    } else {
        selected_stance = stance_id;
        update_displayed_stance();
    }
    
    current_stance = stance_id;

    update_character_stats();
    reset_combat_loops();
}

/**
 * @description handle faving/unfaving of stances
 * @param {String} stance_id 
 */
function fav_stance(stance_id) {
    if(faved_stances[stance_id]) {
        delete faved_stances[stance_id];
    } else if(stances[stance_id].is_unlocked){
        faved_stances[stance_id] = true;
    } else {
        console.warn(`Tried to fav a stance '${stance_id}' despite it not being unlocked!`);
    }
    update_displayed_faved_stances();
}

function unlock_magic(magic_id) {
    if(!magics[magic_id]) {
        console.warn(`Tried to unlock magic "${magic_id}", but no such magic exists!`);
        return;
    }


	if(magics[magic_id].is_unlocked != true) {
    magics[magic_id].is_unlocked = true;
    update_displayed_magic_list();
    log_message(`You have learned a new magic: "${magics[magic_id].names[0]}"`, "magic_unlocked") 
	        return;
    }
}

function cast_magic(magicId, is_auto_cast = false) {
    const magic = magics[magicId];
	const base_duration = magic.duration;
	let magic_duration = magic.duration;

    if (!magic) {
        console.error(`Magic with ID "${magicId}" not found.`);
        return;
    }

    if (magic_cooldowns[magicId] > 0) {
        log_message(`${magic.names[0]} is still on cooldown (${magic_cooldowns[magicId]} ticks left)`);
        return;
    }

    const mana_cost = magic.mana_cost / character.stats.full.mana_efficiency;

    // Handle target_effect spells (combat-only)
    if (magic.target_effect.length > 0) {
		if (current_enemies === null) {
            if (!is_auto_cast) {
                log_message("Can only cast combat spells in combat");
            }
            return;
        }

        if (character.stats.full.mana < mana_cost) {
        if (is_auto_cast) {
            return "low_mana"; // Only for consolidation
        } else {
            log_message("Not enough mana to cast " + magic.names[0]);
        }
        return;
    }

        character.stats.full.mana -= mana_cost;

		const [base_multiplier = 0, target_count = 1, damage_type = null] = magic.target_effect;
		const skill_bonus = skills[magic.related_skill].get_coefficient("multiplicative");
		const magic_power = Math.round(base_multiplier * character.stats.full.magic_power * skill_bonus);

		// Get all alive enemies and pick the first `target_count` ones
		const targets = current_enemies.filter(e => e.is_alive).slice(0, Math.min((target_count + (skills["MultiCasting"].get_level_bonus() || 0)),8)); // adds extra targets from multicasting skill, but caps at 8

		// Cast the spell on each selected target
		targets.forEach(target => {
		do_character_combat_action({
        target,
        attack_power: magic_power, // handling of do_character_combat_action uses attack_power for physical stances and magic_power, but cast_magic we want to exclusively use magic_power
        magic_power: magic_power,
        magic_name: magic.names[0],
        damage_type
    });
	add_xp_to_skill({skill: skills[magic.related_skill], xp_to_add: 100});
	    if (magic.cooldown && magic.cooldown > 0) {
        magic_cooldowns[magicId] = magic.cooldown;
    }
});

     if(current_enemies != null && current_enemies.filter(enemy => enemy.is_alive).length == 0) { //set next loop if there's still an enemy left;
                current_location.enemy_groups_killed += 1;
                if(current_location.enemy_groups_killed > 0 && current_location.enemy_groups_killed % current_location.enemy_count == 0) {
                    get_location_rewards(current_location);
                }
                document.getElementById("enemy_count_div").children[0].children[1].innerHTML = current_location.enemy_count - current_location.enemy_groups_killed % current_location.enemy_count;
        
                set_new_combat();
	 }
    }

    // Handle self_effect spells (non-combat)
   if (magic.self_effect.length > 0) {
        if (character.stats.full.mana < mana_cost) {
        if (is_auto_cast) {
            return "low_mana"; // Only for consolidation
        } else {
            log_message("Not enough mana to cast " + magic.names[0]);
        }
        return;
    }

    character.stats.full.mana -= mana_cost;
	
	const buff_bonus = (skills[magic.related_skill].get_coefficient("multiplicative") || 1);
    const stats = {};
    for (const effect of magic.self_effect) {
        stats[effect.stat] = {};
        if (effect.flat !== undefined) stats[effect.stat].flat = Math.round(effect.flat* (buff_bonus || 1));
        if (effect.multiplier !== undefined) stats[effect.stat].multiplier = Math.round((effect.multiplier* (buff_bonus || 1))*10)/10;
    }
		magic_duration =  Math.round(base_duration* (skills["Magic Extension"].get_coefficient("multiplicative") || 1) );
		
	
		const effect_id = `${magic.names[0]}`;

		const active_effect = new ActiveEffect({
		name: magic.names[0],
		id: effect_id,
		duration: magic_duration,
		effects: { stats }
			});

		active_effects[effect_id] = active_effect;
		effect_templates[effect_id] = active_effect;
		add_xp_to_skill({skill: skills[magic.related_skill], xp_to_add: 100});
		add_xp_to_skill({skill: skills["Magic Extension"], xp_to_add: 100});
		    if (magic.cooldown && magic.cooldown > 0) {
        magic_cooldowns[magicId] = magic.cooldown;
    }
    

        log_message("Cast " + magic.names[0] + " on self", "magic_cast_self");
		update_displayed_effects();
		character.stats.add_active_effect_bonus();
		update_displayed_stats(); 
    }

    // Handle cooldown (optional — depends on your implementation)
		if (magic.special_effect.length > 0) {

           if (character.stats.full.mana < mana_cost) {
        if (is_auto_cast) {
            return "low_mana"; // Only for consolidation
        } else {
            log_message("Not enough mana to cast " + magic.names[0]);
        }
        return;
    }

        character.stats.full.mana -= mana_cost;
		
		if (magic.special_effect == "Warp"){
			change_location("Nexus");
			log_message("Cast " + magic.names[0], "magic_cast_self");
			magic_cooldowns[magicId] = magic.cooldown;
			add_xp_to_skill({skill: skills[magic.related_skill], xp_to_add: 1000});
		}
		
			if (magic.special_effect == "Raise Dead"){
			add_allies_to_party("skeleton1");
			
			magic_cooldowns[magicId] = magic.cooldown;
			add_xp_to_skill({skill: skills[magic.related_skill], xp_to_add: 1000});
		}
		}

    update_displayed_mana();
}

/**
 * @description sets attack cooldowns and new enemies, either from provided list or from current location, called whenever a new enemy group starts
 * @param {List<Enemy>} enemies 
 */
function set_new_combat({enemies} = {}) {
    if (!current_location.get_next_enemies) {
        clear_all_enemy_attack_loops();
        clear_character_attack_loop();
        clear_all_ally_attack_loops(); 
        return;
    }

    current_enemies = enemies || current_location.get_next_enemies();
    clear_all_enemy_attack_loops();
    clear_all_ally_attack_loops();

    // Trigger on_entry effects for each enemy
    current_enemies.forEach(enemy => {
        if (enemy.on_entry && typeof enemy.on_entry === "object") {
            enemy_entrance_effects(enemy.on_entry);
        }
    });

    let character_attack_cooldown = 1 / (character.stats.full.attack_speed);
    enemy_attack_cooldowns = [...current_enemies.map(x => 1 / x.stats.attack_speed)];
    ally_attack_cooldowns = [...current_party.map(x => 1 / allies[x].attack_speed)];

    let all_cooldowns = [
        character_attack_cooldown,
        ...enemy_attack_cooldowns,
        ...ally_attack_cooldowns
    ];
    let fastest_cooldown = all_cooldowns.sort((a, b) => a - b)[0];

    if (fastest_cooldown < 1) {
        const cooldown_multiplier = 1 / fastest_cooldown;

        character_attack_cooldown *= cooldown_multiplier;

        for (let i = 0; i < current_enemies.length; i++) {
            enemy_attack_cooldowns[i] *= cooldown_multiplier;
            enemy_timer_variance_accumulator[i] = 0;
            enemy_timer_adjustment[i] = 0;
            enemy_timers[i] = [Date.now(), Date.now()];
        }

        for (let i = 0; i < current_party.length; i++) {
            ally_attack_cooldowns[i] *= cooldown_multiplier;
            ally_timer_variance_accumulator[i] = 0;
            ally_timer_adjustment[i] = 0;
            ally_timers[i] = [Date.now(), Date.now()];
        }

    } else {
        for (let i = 0; i < current_enemies.length; i++) {
            enemy_timer_variance_accumulator[i] = 0;
            enemy_timer_adjustment[i] = 0;
            enemy_timers[i] = [Date.now(), Date.now()];
        }

        for (let i = 0; i < current_party.length; i++) {
            ally_timer_variance_accumulator[i] = 0;
            ally_timer_adjustment[i] = 0;
            ally_timers[i] = [Date.now(), Date.now()];
        }
    }

    for (let i = 0; i < current_enemies.length; i++) {
        do_enemy_attack_loop(i, 0, true);
    }

    if (current_party.length > 0) {
        for (let i = 0; i < current_party.length; i++) {
            do_ally_attack_loop(i, 0, true);
        }
    }

    set_character_attack_loop({ base_cooldown: character_attack_cooldown });

    update_displayed_enemies();
    update_displayed_health_of_enemies();
}

/**
 * @description Recalculates attack speeds;
 * 
 * For enemies, modifies their existing cooldowns, for hero it restarts the attack bar with a new cooldown 
 */
function reset_combat_loops() {
    if (!current_enemies) { 
        return;
    }

    let character_attack_cooldown = 1 / (character.stats.full.attack_speed);

    // Initialize cooldowns for enemies and allies
    enemy_attack_cooldowns = [...current_enemies.map(x => 1 / x.stats.attack_speed)];
    ally_attack_cooldowns = [...current_party.map(x => 1 / allies[x].attack_speed)];

    // Determine the fastest cooldown among all participants
    let fastest_cooldown = Math.min(
        character_attack_cooldown,
        ...enemy_attack_cooldowns,
        ...ally_attack_cooldowns
    );

    // Normalize all cooldowns if any are faster than 1 per second
    if (fastest_cooldown < 1) {
        const cooldown_multiplier = 1 / fastest_cooldown;

        character_attack_cooldown *= cooldown_multiplier;

        for (let i = 0; i < enemy_attack_cooldowns.length; i++) {
            enemy_attack_cooldowns[i] *= cooldown_multiplier;
        }

        for (let i = 0; i < ally_attack_cooldowns.length; i++) {
            ally_attack_cooldowns[i] *= cooldown_multiplier;
        }
    }

    // Apply the updated cooldown
    set_character_attack_loop({ base_cooldown: character_attack_cooldown });
}

/**
 * @description Creates an Interval responsible for performing the attack loop of enemy and updating their attack_bar progress
 * @param {*} enemy_id 
 * @param {*} cooldown 
 */
function do_enemy_attack_loop(enemy_id, count, is_new = false) {
    count = count || 0;
    update_enemy_attack_bar(enemy_id, count);

    if(is_new) {
        enemy_timer_variance_accumulator[enemy_id] = 0;
        enemy_timer_adjustment[enemy_id] = 0;
    }

    clearTimeout(enemy_attack_loops[enemy_id]);
    enemy_attack_loops[enemy_id] = setTimeout(() => {
        enemy_timers[enemy_id][0] = Date.now(); 
        enemy_timer_variance_accumulator[enemy_id] += ((enemy_timers[enemy_id][0] - enemy_timers[enemy_id][1]) - enemy_attack_cooldowns[enemy_id]*1000/(40*tickrate));

        enemy_timers[enemy_id][1] = Date.now();
        update_enemy_attack_bar(enemy_id, count);
        count++;
        if(count >= 40) {
            count = 0;
            do_enemy_combat_action(enemy_id);
        }
        do_enemy_attack_loop(enemy_id, count);

        if(enemy_timer_variance_accumulator[enemy_id] <= 5/tickrate && enemy_timer_variance_accumulator[enemy_id] >= -5/tickrate) {
            enemy_timer_adjustment[enemy_id] = time_variance_accumulator;
        }
        else {
            if(enemy_timer_variance_accumulator[enemy_id] > 5/tickrate) {
                enemy_timer_adjustment[enemy_id] = 5/tickrate;
            }
            else {
                if(enemy_timer_variance_accumulator[enemy_id] < -5/tickrate) {
                    enemy_timer_adjustment[enemy_id] = -5/tickrate;
                }
            }
        } //limits the maximum correction to +/- 5ms, just to be safe

    }, enemy_attack_cooldowns[enemy_id]*1000/(40*tickrate) - enemy_timer_adjustment[enemy_id]);
}

function clear_enemy_attack_loop(enemy_id) {
    clearTimeout(enemy_attack_loops[enemy_id]);
}

function apply_on_strike_effects(attacker) {
    if (!attacker.on_strike) return { pierce: 0, damage_multiplier: 1 };

    // Handle fleeing
    if (attacker.on_strike.flee === true) {
        const parent = current_location.parent_location.name;
        if (typeof parent === "string" && locations[parent]) {
            change_location(parent);

            if (attacker.name === "Titan Turtle") {
                log_message("The beast very slowly escaped!");
            } else {
                log_message("The beast escaped!");
            }
            return { pierce: 0, damage_multiplier: 1 };
        } else {
            console.error("Invalid parent location:", parent);
            return { pierce: 0, damage_multiplier: 1 };
        }
    }

    // Handle bark messages
    if (Array.isArray(attacker.on_strike.bark) && attacker.on_strike.bark.length > 0) {
        const message = attacker.on_strike.bark.shift(); // Remove and get the first message
        if (typeof message === "string") {
            log_message(`"${message}"`, "background");
        }
    }

    let pierce = attacker.on_strike.pierce || 0;
    let damage_multiplier = attacker.on_strike.multistrike || 1;

const status_effects = ["poison", "freeze", "burn", "stun", "toxic"];

for (const effect_name of status_effects) {
    // Skip this effect if the player is immune
    if (character.stats.immunities?.[effect_name]) continue;

    const effect_data = attacker.on_strike[effect_name];

    if (effect_data) {
        // Support legacy format (direct duration), or new format ({duration, chance})
        let duration, chance;
        if (typeof effect_data === "object" && effect_data !== null) {
            duration = effect_data.duration;
            chance = effect_data.chance ?? 1;
        } else {
            duration = effect_data;
            chance = 1;
        }

        if (Math.random() <= chance) {
            let stats = {};

            switch (effect_name) {
                case "poison":
                    stats = {
                        health_loss_flat: {
                            flat: Math.round(
                                -2 *
                                    (1 -
                                        skills["Poison resistance"].current_level /
                                            skills["Poison resistance"].max_level) *
                                    10
                            ) / 10,
                        },
                    };
                    add_xp_to_skill({ skill: skills["Poison resistance"], xp_to_add: 3 });
                    break;

                case "toxic":
                    stats = {
                        health_loss_flat: {
                            flat: Math.round(
                                -5 *
                                    (1 -
                                        skills["Poison resistance"].current_level /
                                            skills["Poison resistance"].max_level) *
                                    10
                            ) / 10,
                        },
                    };
                    add_xp_to_skill({ skill: skills["Poison resistance"], xp_to_add: 20 });
                    break;

                case "freeze":
                    stats = {
                        attack_speed: {
                            multiplier: Math.round(
                                0.5 *
                                    (1 -
                                        skills["Cold resistance"].current_level /
                                            skills["Cold resistance"].max_level) *
                                    10
                            ) / 10,
                        },
                    };
                    add_xp_to_skill({ skill: skills["Cold resistance"], xp_to_add: 3 });
                    break;

                case "burn":
                    stats = {
                        health_loss_flat: {
                            flat: Math.round(
                                -2 *
                                    (1 -
                                        skills["Heat resistance"].current_level /
                                            skills["Heat resistance"].max_level) *
                                    10
                            ) / 10,
                        },
                    };
                    add_xp_to_skill({ skill: skills["Heat resistance"], xp_to_add: 3 });
                    break;

                case "stun":
                    stats = {
                        attack_speed: { multiplier: 0.1 },
                    };
                    break;
            }

            const effect = new ActiveEffect({
                name: effect_name.charAt(0).toUpperCase() + effect_name.slice(1),
                duration,
                effects: { stats },
            });

            active_effects[effect.id] = effect;
            effect_templates[effect.id] = effect;

            update_displayed_effects();
            character.stats.add_active_effect_bonus();
            update_character_stats();
            update_displayed_stats();

            log_message(character.name + " was affected by " + effect.name + " for " + duration + " ticks.", "status_effect");
        }
    }
}

    return { pierce, damage_multiplier };
}

function apply_on_connectedstrike_effects(attacker) {
    if (!attacker.on_connectedstrike) return;

    const data = attacker.on_connectedstrike;

    // Handle fleeing
    if (data.flee === true) {
        const parent = current_location.parent_location.name;
        if (typeof parent === "string" && locations[parent]) {
            change_location(parent);

            if (attacker.name === "Titan Turtle") {
                log_message("The beast very slowly escaped!");
            } else {
                log_message("The beast escaped!");
            }
            return;
        } else {
            console.error("Invalid parent location:", parent);
            return;
        }
    }

    // Handle bark messages
    if (Array.isArray(data.bark) && data.bark.length > 0) {
        const message = data.bark.shift(); // Remove and get the first message
        if (typeof message === "string") {
            log_message(`"${message}"`, "background");
        }
    }

    // Handle status effects
   const status_effects = ["poison", "freeze", "burn", "stun", "toxic"];

for (const effect_name of status_effects) {
    // Skip this effect if the player is immune
    if (character.stats.immunities?.[effect_name]) continue;

    const effect_data = attacker.on_connectedstrike[effect_name];

    if (effect_data) {
        // Support legacy format (direct duration), or new format ({duration, chance})
        let duration, chance;
        if (typeof effect_data === "object" && effect_data !== null) {
            duration = effect_data.duration;
            chance = effect_data.chance ?? 1;
        } else {
            duration = effect_data;
            chance = 1;
        }

        if (Math.random() <= chance) {
            let stats = {};

            switch (effect_name) {
                case "poison":
                    stats = {
                        health_loss_flat: {
                            flat: Math.round(
                                -2 *
                                    (1 -
                                        skills["Poison resistance"].current_level /
                                            skills["Poison resistance"].max_level) *
                                    10
                            ) / 10,
                        },
                    };
                    add_xp_to_skill({ skill: skills["Poison resistance"], xp_to_add: 3 });
                    break;

                case "toxic":
                    stats = {
                        health_loss_flat: {
                            flat: Math.round(
                                -5 *
                                    (1 -
                                        skills["Poison resistance"].current_level /
                                            skills["Poison resistance"].max_level) *
                                    10
                            ) / 10,
                        },
                    };
                    add_xp_to_skill({ skill: skills["Poison resistance"], xp_to_add: 20 });
                    break;

                case "freeze":
                    stats = {
                        attack_speed: {
                            multiplier: Math.round(
                                0.5 *
                                    (1 -
                                        skills["Cold resistance"].current_level /
                                            skills["Cold resistance"].max_level) *
                                    10
                            ) / 10,
                        },
                    };
                    add_xp_to_skill({ skill: skills["Cold resistance"], xp_to_add: 3 });
                    break;

                case "burn":
                    stats = {
                        health_loss_flat: {
                            flat: Math.round(
                                -2 *
                                    (1 -
                                        skills["Heat resistance"].current_level /
                                            skills["Heat resistance"].max_level) *
                                    10
                            ) / 10,
                        },
                    };
                    add_xp_to_skill({ skill: skills["Heat resistance"], xp_to_add: 3 });
                    break;

                case "stun":
                    stats = {
                        attack_speed: { multiplier: 0.1 },
                    };
                    break;
            }

            const effect = new ActiveEffect({
                name: effect_name.charAt(0).toUpperCase() + effect_name.slice(1),
                duration,
                effects: { stats },
            });

            active_effects[effect.id] = effect;
            effect_templates[effect.id] = effect;

            update_displayed_effects();
            character.stats.add_active_effect_bonus();
            update_character_stats();
            update_displayed_stats();

            log_message(character.name + " was affected by " + effect.name + " for " + duration + " ticks.", "status_effect");
        }
    }
}
}

function maybe_log_bark(bark) {
    if (!bark) return;

    // If it's a string or string array
    if (typeof bark === "string" && bark.trim().length > 0) {
        log_message(`"${bark}"`, "background");
    } else if (Array.isArray(bark) && bark.length > 0) {
        const message = bark.shift();
        if (typeof message === "string") {
            log_message(`"${message}"`, "background");
        }
    } else if (typeof bark === "object" && bark.message) {
        const chance = typeof bark.chance === "number" ? bark.chance : 1.0;
        if (Math.random() <= chance) {
            maybe_log_bark(bark.message); // Recursively handle inner message
        }
    }
}

/**
 * 
 * @param {Number} base_cooldown basic cooldown based on attack speeds of enemies and character (ignoring stamina penalty) 
 * @param {String} attack_type type of attack, not yet implemented
 */
function set_character_attack_loop({base_cooldown}) {
    clear_character_attack_loop();

    // little safety, as this function would occasionally throw an error due to not having any enemies left 
    //(can happen on forced leave after first win)
    if (!current_enemies) {
        return;
    }

    // Tries to switch stance back to the one that was actually selected if there's enough stamina, 
    // otherwise tries to switch stance to "normal" if not enough stamina
	//this correcly switched out of stances if you don't meet stamina or mana cost, but doesn't seem to update that it's switched you back into normal stance. but stat total show that it has.
    if ((character.stats.full.stamina >= (stances[selected_stance].stamina_cost / character.stats.full.stamina_efficiency)) && (character.stats.full.mana >= (stances[selected_stance].mana_cost / character.stats.full.mana_efficiency))) {
        if (selected_stance !== current_stance) {
            change_stance(selected_stance);
			update_displayed_stance();
            return;
        }
    } else if (current_stance !== "normal") {
        change_stance("normal", true);
		update_displayed_stance();
        return;
    }

    let target_count = stances[current_stance].target_count;
    if (target_count > 1 && stances[current_stance].related_skill) {
        target_count = target_count + Math.round(target_count * skills[stances[current_stance].related_skill].current_level / skills[stances[current_stance].related_skill].max_level);
    }

    if (stances[current_stance].randomize_target_count) {
        target_count = Math.floor(Math.random() * target_count) || 1;
    }

    let targets = [];
    const alive_targets = current_enemies.filter(enemy => enemy.is_alive).slice(-target_count);

    while (alive_targets.length > 0) {
        targets.push(alive_targets.pop());
    }

	// Check if stamina_cost >= 1 before using stamina
    if (stances[current_stance].stamina_cost >= 1) {
        use_stamina(stances[current_stance].stamina_cost);
    }

    // Check if mana_cost >= 1 before using mana
    if (stances[current_stance].mana_cost >= 1) {
        use_mana(stances[current_stance].mana_cost);
    }

    let actual_cooldown = base_cooldown / character.get_stamina_multiplier();
    let attack_power = character.get_attack_power();
	let magic_power = character.get_magic_power();
    
    do_character_attack_loop({ base_cooldown, actual_cooldown, attack_power, magic_power, targets });
}

/**
 * @description updates character's attack bar, performs combat action when it reaches full
 * @param {Number} base_cooldown 
 * @param {Number} actual_cooldown 
 * @param {String} attack_power 
 * @param {String} attack_type 
 */
function do_character_attack_loop({base_cooldown, actual_cooldown, attack_power, magic_power, targets}) {
    let count = 0;
    clear_character_attack_loop();
    character_attack_loop = setInterval(() => {
        update_character_attack_bar(count);
        count++;
        if(count >= 40) {
            count = 0;
            let leveled = false;


if (stances[current_stance].stance_type === "Physical") {
            for(let i = 0; i < targets.length; i++) {
                do_character_combat_action({target: targets[i], attack_power});
            }
			
} else if (stances[current_stance].stance_type === "Magical") {
			for(let i = 0; i < targets.length; i++) {
                do_character_combat_action({target: targets[i], magic_power});
            }
} else {
    // Optionally, handle cases where the stance_type is neither "Physical" nor "Magical"
    console.log("Unknown stance type");
    hero_base_damage = 0; // Default or fallback value
	log_message(stances[current_stance]);
	log_message(stances[current_stance].stamina_cost);
	log_message(stances[current_stance].name);
}




            if(stances[current_stance].related_skill) {
                leveled = add_xp_to_skill({skill: skills[stances[current_stance].related_skill], xp_to_add: targets.reduce((sum,enemy)=>sum+enemy.xp_value,0)/targets.length});
                
                if(leveled) {
                    update_stance_tooltip(current_stance);
                    update_character_stats();
                }
            }

            if(current_enemies.filter(enemy => enemy.is_alive).length != 0) { //set next loop if there's still an enemy left;
                set_character_attack_loop({base_cooldown});
            } else { //all enemies defeated, do relevant things and set new combat

                current_location.enemy_groups_killed += 1;
                if(current_location.enemy_groups_killed > 0 && current_location.enemy_groups_killed % current_location.enemy_count == 0) {
                    get_location_rewards(current_location);
                }
                document.getElementById("enemy_count_div").children[0].children[1].innerHTML = current_location.enemy_count - current_location.enemy_groups_killed % current_location.enemy_count;
        
                set_new_combat();
            }
        }
    }, actual_cooldown*1000/(40*tickrate));
}

function clear_character_attack_loop() {
    clearInterval(character_attack_loop);
}

function clear_all_enemy_attack_loops() {
    Object.keys(enemy_attack_loops).forEach((key) => {
        clearInterval(enemy_attack_loops[key]);
    })
}

function start_combat() {
    if(current_enemies == null) {
        set_new_combat();
    }
}


///ally_attack_loop_handling

function do_ally_attack_loop(ally_index, count = 0, is_new = false) {
    count = count || 0;
    update_ally_attack_bar(ally_index, count);

    if (is_new) {
        ally_timer_variance_accumulator[ally_index] = 0;
        ally_timer_adjustment[ally_index] = 0;
    }

    clearTimeout(ally_attack_loops[ally_index]);
    ally_attack_loops[ally_index] = setTimeout(() => {
        ally_timers[ally_index][0] = Date.now();
        ally_timer_variance_accumulator[ally_index] += ((ally_timers[ally_index][0] - ally_timers[ally_index][1]) - ally_attack_cooldowns[ally_index] * 1000 / (40 * tickrate));

        ally_timers[ally_index][1] = Date.now();
        update_ally_attack_bar(ally_index, count);
        count++;

        if (count >= 40) {
            count = 0;
            do_ally_combat_action(ally_index);
        }

        do_ally_attack_loop(ally_index, count);

        if (ally_timer_variance_accumulator[ally_index] <= 5 / tickrate && ally_timer_variance_accumulator[ally_index] >= -5 / tickrate) {
            ally_timer_adjustment[ally_index] = time_variance_accumulator;
        } else {
            if (ally_timer_variance_accumulator[ally_index] > 5 / tickrate) {
                ally_timer_adjustment[ally_index] = 5 / tickrate;
            } else if (ally_timer_variance_accumulator[ally_index] < -5 / tickrate) {
                ally_timer_adjustment[ally_index] = -5 / tickrate;
            }
        }

    }, ally_attack_cooldowns[ally_index] * 1000 / (40 * tickrate) - ally_timer_adjustment[ally_index]);
}

function clear_all_ally_attack_loops() {
    for (let id in ally_attack_loops) {
        clearTimeout(ally_attack_loops[id]);
    }
}

function do_ally_combat_action(ally_index) {
    if (!current_party[ally_index]) return;
	if (!current_enemies) return;

    const ally_id = current_party[ally_index];
    const ally = allies[ally_id];
    if (!ally) return;

    const ally_base_damage = (ally.attack_power * skills["Leadership"].get_coefficient("multiplicative") * Math.max(character.xp.current_level,1));
    const target_count = ally.target_count;
    const AP = (ally.AP * skills["Leadership"].get_coefficient("multiplicative") * Math.max(character.xp.current_level,1));

    const alive_targets = current_enemies.filter(enemy => enemy.is_alive).slice(-target_count);
    const targets = [...alive_targets].reverse(); // Get last N alive enemies

    for (const target of targets) {
        let damage_dealt = ally_base_damage;
        let critted = false;

        const hit_chance_modifier = current_enemies.filter(e => e.is_alive).length ** (-1 / 4);
        const hit_chance = get_hit_chance(AP, target.stats.agility * Math.sqrt(target.stats.intuition ?? 1)) * hit_chance_modifier;

        if (hit_chance > Math.random()) {
            // Successful hit
            if (Math.random() < 0.1) { // 10% crit
                damage_dealt = Math.round(10 * damage_dealt * 1.3) / 10;
                critted = true;
            }

            damage_dealt = Math.ceil(10 * Math.max(damage_dealt - target.stats.defense, damage_dealt * 0.1, 1)) / 10;
            target.stats.health -= damage_dealt;

            if (critted) {
                log_message(`${target.name} was critically hit by ${ally.name} for ${damage_dealt} dmg`, "enemy_attacked_critically");
                
            } else {
                log_message(`${target.name} was hit by ${ally.name} for ${damage_dealt} dmg`, "enemy_attacked");
            }
			
			add_xp_to_skill({ skill: skills["Leadership"], xp_to_add: target.xp_value });
			
            if (target.stats.health <= 0) {
                target.stats.health = 0;
                total_kills++;
                log_message(`${target.name} was defeated`, "enemy_defeated");

                const xp_reward = target.xp_value * (current_enemies.length ** 0.3334) * 0.5; //half xp when ally kills enemy
                add_xp_to_character(xp_reward, true); // XP goes to character, not ally

                var loot = target.get_loot();
                if (loot.length > 0) {
                    log_loot(loot);
                    add_to_character_inventory(loot);
                }
				
                kill_enemy(target);
				

                if (target.on_death && Object.keys(target.on_death).length > 0) {
                    execute_death_effects(target.on_death);
                }
            }

            update_displayed_health_of_enemies();
        } else {
            log_message(`${ally.name} has missed`, "hero_missed");
        }
    }
	
	            if(current_enemies != null && current_enemies.filter(enemy => enemy.is_alive).length == 0) { //set next loop if there's still an enemy left;
                current_location.enemy_groups_killed += 1;
                if(current_location.enemy_groups_killed > 0 && current_location.enemy_groups_killed % current_location.enemy_count == 0) {
                    get_location_rewards(current_location);
                }
                document.getElementById("enemy_count_div").children[0].children[1].innerHTML = current_location.enemy_count - current_location.enemy_groups_killed % current_location.enemy_count;
        
                set_new_combat();
            } 
}


/**
 * performs a single combat action (that is attack, as there isn't really any other kind for now),
 * called when attack cooldown finishes
 * 
 * @param {String} attacker id of enemy
*/ 
function do_enemy_combat_action(enemy_id) {
    
    /*
    tiny workaround, as character being defeated while facing multiple enemies,
    sometimes results in enemy attack animation still finishing before character retreats,
    launching this function and causing an error
    */
    if(!current_enemies) { 
        return;
    }
    
    const attacker = current_enemies[enemy_id];

    let evasion_chance_modifier = current_enemies.filter(enemy => enemy.is_alive).length**(-1/3); //down to .5 if there's full 8 enemies (multiple attackers make it harder to evade attacks)
    if(attacker.size === "small") {
        add_xp_to_skill({skill: skills["Pest killer"], xp_to_add: attacker.xp_value});
    } else if(attacker.size === "large") {
        add_xp_to_skill({skill: skills["Giant slayer"], xp_to_add: attacker.xp_value});
        evasion_chance_modifier *= skills["Giant slayer"].get_coefficient("multiplicative");
    }

    const enemy_base_damage = attacker.stats.attack;

    let damage_dealt;

    let critted = false;

    let partially_blocked = false; //only used for combat info in message log

    const { pierce, damage_multiplier } = apply_on_strike_effects(attacker);

	damage_dealt = enemy_base_damage * (1.2 - Math.random() * 0.4);
	damage_dealt *= damage_multiplier; // multistrike applied as damage multiplier.
    
    if(character.equipment["off-hand"]?.offhand_type === "shield") { //HAS SHIELD
		       const hit_chance = get_hit_chance(attacker.stats.dexterity * Math.sqrt(attacker.stats.intuition ?? 1), (character.stats.full.evasion_points*character.stats.full.block_chance*(0.15+skills["Parrying"].get_level_bonus()))/evasion_chance_modifier);

        if(hit_chance < Math.random()) { //EVADED ATTACK
            const xp_to_add = character.wears_armor() ? attacker.xp_value : attacker.xp_value * 1.5; 
            //50% more parrying & shielding xp if going without armor
            add_xp_to_skill({skill: skills["Parrying"], xp_to_add});
			add_xp_to_skill({skill: skills["Shield blocking"], xp_to_add});
            log_message(character.name + " parried an attack", "enemy_missed");
			perform_counterattack(attacker);
            return; //damage fully evaded, nothing more can happen
      

		   } else {
            add_xp_to_skill({skill: skills["Parrying"], xp_to_add: attacker.xp_value/2});
			        if(character.stats.full.block_chance > Math.random()) {//BLOCKED THE ATTACK
            add_xp_to_skill({skill: skills["Shield blocking"], xp_to_add: attacker.xp_value});
            if(character.stats.total_multiplier.block_strength * character.equipment["off-hand"].getShieldStrength() >= damage_dealt) {
                log_message(character.name + " blocked an attack", "hero_blocked");
                return; //damage fully blocked, nothing more can happen 
            } else {
                damage_dealt -= character.stats.total_multiplier.block_strength * character.equipment["off-hand"].getShieldStrength();
                partially_blocked = true;
            }
         } else {
            add_xp_to_skill({skill: skills["Shield blocking"], xp_to_add: attacker.xp_value/2});
         }
        }
    } else { // HAS NO SHIELD
        const hit_chance = get_hit_chance(attacker.stats.dexterity * Math.sqrt(attacker.stats.intuition ?? 1), character.stats.full.evasion_points)/evasion_chance_modifier;

        if(hit_chance < Math.random()) { //EVADED ATTACK
            const xp_to_add = character.wears_armor() ? attacker.xp_value : attacker.xp_value * 1.5; 
            //50% more evasion xp if going without armor
            add_xp_to_skill({skill: skills["Evasion"], xp_to_add});
            log_message(character.name + " evaded an attack", "enemy_missed");
			perform_counterattack(attacker);
            return; //damage fully evaded, nothing more can happen
        } else {
            add_xp_to_skill({skill: skills["Evasion"], xp_to_add: attacker.xp_value/2});
        }
    }

    if(enemy_crit_chance > Math.random())
    {
        damage_dealt *= enemy_crit_damage;
        critted = true;
    }
    if(!character.wears_armor())
    {
        add_xp_to_skill({skill: skills["Iron skin"], xp_to_add: attacker.xp_value});
    } else {
        add_xp_to_skill({skill: skills["Iron skin"], xp_to_add: Math.sqrt(attacker.xp_value)/2});
    }
	
	if(character.stats.full.health < 0.5*(character.stats.full.max_health)) {
        add_xp_to_skill({skill: skills["Resilience"], xp_to_add: attacker.xp_value});
    }

	if(character.stats.full.health < 0.1*(character.stats.full.max_health)) {
        add_xp_to_skill({skill: skills["Last Stand"], xp_to_add: attacker.xp_value});
    }

	apply_on_connectedstrike_effects(attacker);

    let { damage_taken, fainted } = character.take_damage({
    damage_value: damage_dealt,
    pierce: pierce // Pass from earlier destructured result
});

let multistike_str = damage_multiplier > 1 ? ` (x ${damage_multiplier} multistrike)` : "";
let damage_type_str = attacker.damage_type ? ` (${attacker.damage_type} damage)` : "";
let pierce_str = pierce > 0 ? ` (pierced ${pierce} defense)` : "";

if (critted) {
    if (partially_blocked) {
        log_message(
            `${character.name} partially blocked, was critically hit for ${Math.ceil(10 * damage_taken) / 10} dmg${multistike_str}${pierce_str}${damage_type_str}`,
            "hero_attacked_critically"
        );
    } else {
        log_message(
            `${character.name} was critically hit for ${Math.ceil(10 * damage_taken) / 10} dmg${multistike_str}${pierce_str}${damage_type_str}`,
            "hero_attacked_critically"
        );
    }
} else {
    if (partially_blocked) {
        log_message(
            `${character.name} partially blocked, was hit for ${Math.ceil(10 * damage_taken) / 10} dmg${multistike_str}${pierce_str}${damage_type_str}`,
            "hero_attacked"
        );
    } else {
        log_message(
            `${character.name} was hit for ${Math.ceil(10 * damage_taken) / 10} dmg${multistike_str}${pierce_str}${damage_type_str}`,
            "hero_attacked"
        );
    }
}

    if(fainted) {
        total_deaths++;
        log_message(character.name + " has lost consciousness", "hero_defeat")
		add_xp_to_skill({skill: skills["Undying"], xp_to_add: 100});;

        update_displayed_health();
        if(options.auto_return_to_bed && last_location_with_bed) {
            change_location(last_location_with_bed);
            start_sleeping();
        } else {
            change_location(current_location.parent_location.name);
        }
		locations["Time Demon"].is_finished = true;
        return;
    }

    update_displayed_health();
	perform_counterattack(attacker);
}

function enemy_tag_to_skill(tag) {
    const tagToSkillMap = {
    "animated": "Smasher",
    "undead": "Purifier",
    "dragonoid": "Dragon Slayer",
    "amorphous": "Slime Culler",
    "humanoid": "Man Slayer",
    "spirit": "Exorcist",
    "fire": "Extinguisher",
	"ice": "Defroster",
	"arthropod": "Exterminator",
	"abomination": "Monster Hunter",
	"beast": "Hunter",			
};
    return tagToSkillMap[tag];
}

function do_character_combat_action({target, attack_power, magic_power, magic_name = null, damage_type = "Physical"}) {

let hero_base_damage;

if (stances[current_stance].stance_type === "Physical") {
    hero_base_damage = attack_power;  // Use attack_power if the stance is "Physical"
} else if (stances[current_stance].stance_type === "Magical") {
    hero_base_damage = magic_power;   // Use magic_power if the stance is "Magical"
} else {
    // Optionally, handle cases where the stance_type is neither "Physical" nor "Magical"
    console.log("Unknown stance type");
    hero_base_damage = 0; // Default or fallback value
	console.log(stances[current_stance]);
	console.log(stances[current_stance].stamina_cost);
	console.log(stances[current_stance].name);
}


let tags_bonus = 0;
let bestSkill = null;

const enemyTags = (enemy_templates[target.name].tags);

Object.keys(enemyTags).forEach(tag => {
    let extermSkill = (enemy_tag_to_skill(tag) || null);
    // Only proceed if the tag maps to a valid skill
    if (extermSkill && skills[extermSkill]) {
        let coefficient = skills[extermSkill].get_coefficient("multiplicative") || 1;
        // Update highest coefficient and best skill if current one is better
        if (coefficient > tags_bonus) {
            tags_bonus = coefficient;
            bestSkill = extermSkill;
        }
    }
	
});

if(tags_bonus < 1) {
tags_bonus = 1; // returns to 1 if less than 1
}

	

    let damage_dealt;
    
    let critted = false;
    
    let hit_chance_modifier = current_enemies.filter(enemy => enemy.is_alive).length**(-1/4); // down to ~ 60% if there's full 8 enemies
	let damage_modifier = 1;
    
    add_xp_to_skill({skill: skills["Combat"], xp_to_add: target.xp_value});

    if(target.size === "small") {
        add_xp_to_skill({skill: skills["Pest killer"], xp_to_add: target.xp_value});
        hit_chance_modifier *= skills["Pest killer"].get_coefficient("multiplicative");
    } else if(target.size === "large") {
        add_xp_to_skill({skill: skills["Giant slayer"], xp_to_add: target.xp_value});
    } else if(target.size === "medium") {
        add_xp_to_skill({skill: skills["Battling"], xp_to_add: target.xp_value})
		damage_modifier *= skills["Battling"].get_coefficient("multiplicative");
    }
	
	
    const hit_chance = get_hit_chance(character.stats.full.attack_points, target.stats.agility * Math.sqrt(target.stats.intuition ?? 1)) * hit_chance_modifier;
	
					if (stances[current_stance].self_damage > 0) {
			let self_damage = stances[current_stance].self_damage
				execute_self_damage(self_damage);
				update_displayed_health();
            }

    if(hit_chance > Math.random()) {//hero's attack hits

        if(character.equipment.weapon != null) {
            damage_dealt = Math.round(10 * hero_base_damage * tags_bonus * type_bonus * damage_modifier * (1.2 - Math.random() * 0.4) )/10;

            add_xp_to_skill({skill: skills[weapon_type_to_skill[character.equipment.weapon.weapon_type]], xp_to_add: target.xp_value}); 

        } else {
            damage_dealt = Math.round(10 * hero_base_damage * tags_bonus * type_bonus * damage_modifier * (1.2 - Math.random() * 0.4) )/10;
            add_xp_to_skill({skill: skills['Unarmed'], xp_to_add: target.xp_value});
        }
        //small randomization by up to 20%, then bonus from skill
        
        if(character.stats.full.crit_rate > Math.random()) {
            damage_dealt = Math.round(10*damage_dealt * character.stats.full.crit_multiplier)/10;
            critted = true;
        }
        else {
            critted = false;
        }
        
        damage_dealt = Math.ceil(10*Math.max(damage_dealt - target.stats.defense, damage_dealt*0.1, 1))/10;

        target.stats.health -= damage_dealt;
		
		if(damage_dealt > 3*target.stats.max_health){
			add_xp_to_skill({skill: skills["Obliteration"], xp_to_add: target.xp_value});
		}	
		if (critted) {
			const msg = magic_name 
			? `${target.name} was critically hit by ${magic_name} for ${damage_dealt} dmg`
			: `${target.name} was critically hit for ${damage_dealt} dmg`;
			log_message(msg, "enemy_attacked_critically");
			add_xp_to_skill({skill: skills["Criticality"], xp_to_add: target.xp_value});
			} else {
			const msg = magic_name 
			? `${target.name} was hit by ${magic_name} for ${damage_dealt} dmg`
			: `${target.name} was hit for ${damage_dealt} dmg`;
			log_message(msg, "enemy_attacked");
			}

        if(target.stats.health <= 0) {
            total_kills++;
            target.stats.health = 0; //to not go negative on displayed value


            log_message(target.name + " was defeated", "enemy_defeated");

            //gained xp multiplied ny TOTAL size of enemy group raised to 1/3
            let xp_reward = target.xp_value * (current_enemies.length**0.3334);
            add_xp_to_character(xp_reward, true);
            

            var loot = target.get_loot();
            if(loot.length > 0) {
                log_loot(loot);
                add_to_character_inventory(loot);
            }
		
		
		// Rare loot generation (0.1% chance)
let rare_loot = [];
if (Math.random() < 0.0001 && Array.isArray(rare_items_pool) && rare_items_pool.length > 0) {
    const rareItemName = rare_items_pool[Math.floor(Math.random() * rare_items_pool.length)];
    if (item_templates[rareItemName]) {
        rare_loot.push({ "item": getItem(item_templates[rareItemName]), "count": 1 });
    } else {
        console.warn(`Tried to loot rare item "${rareItemName}", but such an item doesn't exist in item_templates!`);
    }
}

if (rare_loot.length > 0) {
    log_rare_loot(rare_loot);
    add_to_character_inventory(rare_loot);
}
		
		
            
            kill_enemy(target);
			if (bestSkill != null){
			add_xp_to_skill({skill: skills[bestSkill], xp_to_add: target.xp_value});
			}
		
		if(character.equipment.weapon != null){
	if (item_templates[character.equipment?.weapon.id].special_effects.length > 0) {
    execute_weapon_special_effects(item_templates[character.equipment.weapon.id].special_effects);
}			
}		

		if (target.on_death && Object.keys(target.on_death).length > 0) {
			execute_death_effects(target.on_death)
}

			//add_xp_to_skill({skill: skills["MultiCasting"], xp_to_add: 1000});
			//unlock_magic("Fireball");
			//regress();
			//console.log(character.stats.total_flat.max_health * character.stats.total_multiplier.max_health);
			//console.log(target); //enable for debugging purposes



		// magic stance xp for killing enemies
		if (stances[current_stance].stance_type === "Magical") {
				add_xp_to_skill({skill: skills["Magic Potency"], xp_to_add: 100});
            }
        }

        
		


        update_displayed_health_of_enemies();
    } else {
        log_message(character.name + " has missed", "hero_missed");
    }
}


function execute_weapon_special_effects(special_effects) {
    for (const effect of special_effects) {
        switch (effect.name) {
            case "greed":
                // Handle greed effect
                add_money_to_character(effect.value);
                break;
                
            case "leech":
                // Handle leech effect
                character.stats.full.health += effect.value;
				update_character_stats();
                break;
				
			    case "siphon":
                // Handle siphon effect
                character.stats.full.mana += effect.value; 
				update_character_stats();
                break;
                
            // Add more cases for other special effects as needed
                
            default:
                console.warn(`Unknown special effect: ${effect.name}`);
        }
    }
}

function execute_death_effects(on_death) {
    if (!on_death) return;

    // Handle death bark
	 if (on_death.bark != null) {
        maybe_log_bark(on_death.bark);
    }

    // Handle setting global flags
    if (on_death.flags && Array.isArray(on_death.flags)) {
        on_death.flags.forEach(flag => {
            if (global_flags.hasOwnProperty(flag)) {
                global_flags[flag] = true;
            } else {
                console.warn(`Unknown global flag: ${flag}`);
            }
        });
    }

    // Handle special hero damage with a message
    if (typeof on_death.hero_damage === 'number' && on_death.hero_damage > 0) {
        log_message(character.name + " received " + (on_death.hero_damage) + " defense bypassing damage from a dying enemy", "hero_missed");
        let { damage_taken, fainted } = character.take_damage({ damage_value: on_death.hero_damage, negate_defense: true });
        update_displayed_health();

        if (fainted) {
            total_deaths++;
            log_message(character.name + " fainted due to damage from a dying enemy", "hero_defeat");
            log_message(character.name + " has lost consciousness", "hero_defeat");
            add_xp_to_skill({ skill: skills["Undying"], xp_to_add: 1000 });

            update_displayed_health();

            if (options.auto_return_to_bed && last_location_with_bed) {
                change_location(last_location_with_bed);
                start_sleeping();
            } else {
                change_location(current_location.parent_location.name);
            }
			locations["Time Demon"].is_finished = true;
            return;
        }
    }

    // Placeholder for future death effects
    if (on_death.custom_effects && typeof on_death.custom_effects === 'function') {
        on_death.custom_effects();
    }
}

function enemy_entrance_effects(on_entry) {
    if (!on_entry) return;

    // Handle entrance bark
    if (on_entry.bark != null) {
        maybe_log_bark(on_entry.bark);
    }

    // Handle setting global flags
    if (on_entry.flags && Array.isArray(on_entry.flags)) {
        on_entry.flags.forEach(flag => {
            if (global_flags.hasOwnProperty(flag)) {
                global_flags[flag] = true;
            } else {
                console.warn(`Unknown global flag: ${flag}`);
            }
        });
    }

    // Handle instant hero damage
    if (typeof on_entry.hero_damage === 'number' && on_entry.hero_damage > 0) {
        log_message(character.name + " took " + on_entry.hero_damage + " damage from a sudden ambush!", "hero_missed");

        let { damage_taken, fainted } = character.take_damage({ damage_value: on_entry.hero_damage, negate_defense: true });
        update_displayed_health();

        if (fainted) {
            total_deaths++;
            log_message(character.name + " was overwhelmed in a surprise attack!", "hero_defeat");
            log_message(character.name + " has lost consciousness", "hero_defeat");
            add_xp_to_skill({ skill: skills["Undying"], xp_to_add: 1000 });

            update_displayed_health();

            if (options.auto_return_to_bed && last_location_with_bed) {
                change_location(last_location_with_bed);
                start_sleeping();
            } else {
                change_location(current_location.parent_location.name);
            }
			locations["Time Demon"].is_finished = true;
            return;
        }
    }

    // Placeholder for future entrance effects
    if (on_entry.custom_effects && typeof on_entry.custom_effects === 'function') {
        on_entry.custom_effects();
    }
}

function perform_counterattack(attacker) {
	let stance_counter_rate = (stances[current_stance].counter_rate || 0.05)
	counter_chance = (stance_counter_rate * skills["Counterattack"].get_coefficient("multiplicative"));
	if (Math.random() < counter_chance ){
	
	
	let counter_damage_modifier = (0.25 * (skills["Counterattack"].get_coefficient("multiplicative") || 1));
	let attack_damage = 1;

	if (stances[current_stance].stance_type === "Physical") {
    attack_damage = counter_damage_modifier* character.get_attack_power();
			
	} else if (stances[current_stance].stance_type === "Magical") {
	attack_damage = counter_damage_modifier* character.get_magic_power();
	}
	

	add_xp_to_skill({skill: skills["Counterattack"], xp_to_add: attack_damage})
	do_character_combat_action({target: attacker, attack_power: attack_damage, magic_power: attack_damage, magic_name: "Counterattack"});
	log_message(character.name + " performed counterattack", "hero_missed");
	
	
	     if(current_enemies != null && current_enemies.filter(enemy => enemy.is_alive).length == 0) { //set next loop if there's still an enemy left;
                current_location.enemy_groups_killed += 1;
                if(current_location.enemy_groups_killed > 0 && current_location.enemy_groups_killed % current_location.enemy_count == 0) {
                    get_location_rewards(current_location);
                }
                document.getElementById("enemy_count_div").children[0].children[1].innerHTML = current_location.enemy_count - current_location.enemy_groups_killed % current_location.enemy_count;
        
                set_new_combat();
		 }
	}
}

function execute_self_damage(self_damage) {
	log_message(character.name + " received " + self_damage + " defense bypassing self damage", "hero_missed");
	let {damage_taken, fainted} = character.take_damage({damage_value: self_damage, negate_defense: true});
	
    if(fainted) {
        total_deaths++;
		total_suicides++;
		log_message(character.name + " fainted due to self damage", "hero_defeat")
        log_message(character.name + " has lost consciousness", "hero_defeat")
		add_xp_to_skill({skill: skills["Undying"], xp_to_add: 1000});;

        update_displayed_health();
        if(options.auto_return_to_bed && last_location_with_bed) {
            change_location(last_location_with_bed);
            start_sleeping();
        } else {
            change_location(current_location.parent_location.name);
        }
		locations["Time Demon"].is_finished = true;
        return;
	
}
}

function execute_ambient_damage(ambient_damage, ambient_damage_type, ambient_damage_related_skill) {
	const skill = skills[ambient_damage_related_skill];
	const env_damage_received = Math.round(ambient_damage*(1- skill.current_level/skill.max_level));
	add_xp_to_skill({skill: skills[ambient_damage_related_skill], xp_to_add: ambient_damage});;
	
	log_message(character.name + " received " + env_damage_received + " defense bypassing ambient " + ambient_damage_type + " damage", "hero_missed");
	let {damage_taken, fainted} = character.take_damage({damage_value: env_damage_received, negate_defense: true});
	
	
    if(fainted) {
        total_deaths++;
		enviromental_deaths++;
		log_message(character.name + " succumbed to the elements", "hero_defeat")
        log_message(character.name + " has lost consciousness", "hero_defeat")
		add_xp_to_skill({skill: skills["Undying"], xp_to_add: 1000});;

        update_displayed_health();
        if(options.auto_return_to_bed && last_location_with_bed) {
            change_location(last_location_with_bed);
            start_sleeping();
        } else {
            change_location(current_location.parent_location.name);
        }
		locations["Time Demon"].is_finished = true;
        return;
	
		}
}
/**
 * sets enemy to dead, disabled their attack, checks if that was the last enemy in group
 * @param {Enemy} enemy 
 * @return {Boolean} if that was the last of an enemy group
 */
function kill_enemy(target) {
    target.is_alive = false;

    if(target.add_to_bestiary) {
        if(enemy_killcount[target.name]) {
            enemy_killcount[target.name] += 1;
            update_bestiary_entry(target.name);
        } else {
            enemy_killcount[target.name] = 1;
            create_new_bestiary_entry(target.name);
        }
    }

	
    const enemy_id = current_enemies.findIndex(enemy => enemy===target);
    clear_enemy_attack_loop(enemy_id);
}

function kill_player({is_combat = true} = {}) {
    if(is_combat) {
        total_deaths++;
        log_message(character.name + " has lost consciousness", "hero_defeat");

        update_displayed_health();
        if(options.auto_return_to_bed && last_location_with_bed) {
            change_location(last_location_with_bed);
            start_sleeping();
        } else {
            change_location(current_location.parent_location.id);
        }
    }
	locations["Time Demon"].is_finished = true;
}


function use_stamina(num = 1, use_efficiency = true) {
    
    character.stats.full.stamina -= num/(use_efficiency * character.stats.full.stamina_efficiency || 1);

    if(character.stats.full.stamina < 0)  {
        character.stats.full.stamina = 0;
    }

    if(character.stats.full.stamina < 1) {
        add_xp_to_skill({skill: skills["Persistence"], xp_to_add: num});
        update_displayed_stats();
    }

    update_displayed_stamina();
}

function use_mana(num = 1, use_efficiency = true) {
    
    character.stats.full.mana -= num/(use_efficiency * character.stats.full.mana_efficiency || 1);

    if(character.stats.full.mana < 0)  {
        character.stats.full.mana = 0;
    }

    if(character.stats.full.mana < 0.5*(character.stats.full.max_mana)){
        add_xp_to_skill({skill: skills["Mana Control"], xp_to_add: 100000*num});
        update_displayed_stats();
    }

    update_displayed_mana();
}


/**
 * adds xp to skills, handles their levelups and tooltips
 * @param skill - skill object 
 * @param {Number} xp_to_add 
 * @param {Boolean} should_info 
 */
function add_xp_to_skill({skill, xp_to_add = 1, should_info = true, use_bonus = true, add_to_parent = true, use_pairing = true, from_pairing = false})
{
    let leveled = false;
    if(xp_to_add == 0) {
        return leveled;
    } else if(xp_to_add < 0) {
        console.error(`Tried to add negative xp to skill ${skill.skill_id}`);
        return leveled;
    }
				check_skill_level_vs_flags(skill);

    if(use_bonus) {
        xp_to_add = xp_to_add * get_skill_xp_gain(skill.skill_id);

        if(skill.parent_skill) {
            xp_to_add *= skill.get_parent_xp_multiplier();
        }
    }
	
	

    
    const prev_name = skill.name();
    const was_hidden = skill.visibility_treshold > skill.total_xp;
    
    const {message, gains, unlocks} = skill.add_xp({xp_to_add: xp_to_add});
    const new_name = skill.name();
    if(skill.parent_skill && add_to_parent) {
        if(skill.total_xp > skills[skill.parent_skill].total_xp) {
            /*
                add xp to parent if skill would now have more than the parent
                calc xp ammount so that it's no more than the difference between child and parent
            */
            let xp_for_parent = Math.min(skill.total_xp - skills[skill.parent_skill].total_xp, xp_to_add);
            add_xp_to_skill({skill: skills[skill.parent_skill], xp_to_add: xp_for_parent, should_info, use_bonus: false, add_to_parent});
        }
    }
	
	if (use_pairing === true && from_pairing === false){
	check_pairings(skill);
					// Add XP to other paired skills
			const paired_set = get_paired_set(skill.skill_id);
		if (paired_set && paired_set.size > 1) {
			for (let other_id of paired_set) {
				if (other_id !== skill.skill_id) {
					let other_skill = skills[other_id];
					// Add XP only if not already added in this call
					if (other_skill.total_xp < skill.total_xp) {
						add_xp_to_skill({
						skill: other_skill,
						xp_to_add: xp_to_add,
						should_info: false,
						use_bonus: false,
						add_to_parent: false,
						from_pairing: true
					});
					}
				}
			}
			// Sync all paired skills to the highest XP value
			sync_paired_skills_to_highest(Array.from(paired_set));
			const leader_name = getGroupLeaderName(skill.skill_id);
			
			
		}
	}
    const is_visible = skill.visibility_treshold <= skill.total_xp;
	


    if(was_hidden && is_visible) 
    {
        create_new_skill_bar(skill);
        update_displayed_skill_bar(skill, false);
        
        if(typeof should_info === "undefined" || should_info) {
            log_message(`Unlocked new skill: ${skill.name()}`, "skill_raised");
        }
    } 

    if(gains) { 
        character.stats.add_skill_milestone_bonus(gains);
        if(skill.skill_id === "Unarmed") {
            character.stats.add_all_equipment_bonus();
        }
    }
    
    if(is_visible) 
    {
        if(typeof message !== "undefined"){ 
        //not undefined => levelup happened and levelup message was returned
            leveled = true;
				if(skill.skill_id === "Limit Breaking"){
		character.recalculate_xp_thresholds();
	}
            update_displayed_skill_bar(skill, true);

            if(typeof should_info === "undefined" || should_info)
            {
                log_message(message, "skill_raised");
                update_character_stats();
            }

            if(typeof skill.get_effect_description !== "undefined")
            {
                update_displayed_skill_description(skill);
            }

            if(skill.is_parent) {
                update_all_displayed_skills_xp_gain();
            }
            else {
                update_displayed_skill_xp_gain(skill);
            }

            //no point doing any checks for optimization
            update_displayed_stamina_efficiency();
			update_displayed_mana_efficiency();
			update_displayed_droprate();

            for(let i = 0; i < unlocks?.skills?.length; i++) {
                const unlocked_skill = skills[unlocks.skills[i]];
                
                if(which_skills_affect_skill[unlocks.skills[i]]) {
                    if(!which_skills_affect_skill[unlocks.skills[i]].includes(skill.skill_id)) {
                        which_skills_affect_skill[unlocks.skills[i]].push(skill.skill_id);
                    }
                } else {
                    which_skills_affect_skill[unlocks.skills[i]] = [skill.skill_id];
                }

                if(unlocked_skill.is_unlocked) {
                    continue;
                }
                
                unlocked_skill.is_unlocked = true;
        
                create_new_skill_bar(unlocked_skill);
                update_displayed_skill_bar(unlocked_skill, false);
                
                if(typeof should_info === "undefined" || should_info) {
                    log_message(`Unlocked new skill: ${unlocked_skill.name()}`, "skill_raised");
                }
				
            }

            if(prev_name !== new_name) {
                if(which_skills_affect_skill[skill.skill_id]) {
                    for(let i = 0; i < which_skills_affect_skill[skill.skill_id].length; i++) {
                        update_displayed_skill_bar(skills[which_skills_affect_skill[skill.skill_id][i]], false);
                    }
                }

                if(!was_hidden && (typeof should_info === "undefined" || should_info)) {
                    log_message(`Skill ${prev_name} upgraded to ${new_name}`, "skill_raised");
                }

                if(current_location?.connected_locations) {
                    for(let i = 0; i < current_location.activities.length; i++) {
                        if(activities[current_location.activities[i].activity_name].base_skills_names.includes(skill.skill_id)) {
                            update_gathering_tooltip(current_location.activities[i]);
                        }
                    }
                }
            }

        } else {
            update_displayed_skill_bar(skill, false);
        }
    } else {
        //
    }
	
	
	
	update_displayed_droprate();
	
    return leveled;

}

function check_skill_level_vs_flags(skill){

if(skill.skill_id === "Mining" && skill.current_level > 19){
	global_flags.is_mining_level20 = true;
}
if(skill.skill_id === "Woodcutting" && skill.current_level > 19){
	global_flags.is_woodcutting_level20 = true;
}
if(skill.skill_id === "Herbalism" && skill.current_level > 19){
	global_flags.is_herbalism_level20 = true;
}
if(skill.skill_id === "Fishing" && skill.current_level > 19){
	global_flags.is_fishing_level20 = true;
}

if(skill.skill_id === "Climbing" && skill.current_level > 9 && global_flags.is_climbing_level10 == false){
	global_flags.is_climbing_level10 = true;
	unlock_activity({location: locations["Tower"].name, 
                            activity: locations["Tower"].activities["climbing2"]});
}

if(skill.skill_id === "Swimming" && skill.current_level > 9 && global_flags.is_swimming_level10 == false){
	global_flags.is_swimming_level10 = true;
	unlock_activity({location: locations["Docks"].name, 
                            activity: locations["Docks"].activities["swimming2"]});
}

if(skill.skill_id === "Climbing" && skill.current_level > 19 && global_flags.is_climbing_level20 == false){
	global_flags.is_climbing_level20 = true;
	unlock_activity({location: locations["Tower"].name, 
                            activity: locations["Tower"].activities["climbing3"]});
}

if(skill.skill_id === "Swimming" && skill.current_level > 19 && global_flags.is_swimming_level20 == false){
	global_flags.is_swimming_level20 = true;
	unlock_activity({location: locations["Docks"].name, 
                            activity: locations["Docks"].activities["swimming3"]});
}

if(skill.skill_id === "Farming" && skill.current_level > 1 && global_flags.is_farming_level2 == false){
	global_flags.is_farming_level2 = true;
}
if(skill.skill_id === "Animal handling" && skill.current_level > 1 && global_flags.is_ahandling_level2 == false){
	global_flags.is_ahandling_level2 = true;
}

if(skill.skill_id === "Weightlifting" && skill.current_level > 1 && global_flags.is_strength_train_level20 == false){
	global_flags.is_strength_train_level20 = true;
}


//unpaired evolutions
if(skill.skill_id === "Crafting" && skill.current_level > 14 && skills["Salvaging"].current_level == 10 && skills["Scrap Mechanic"].current_level == 0){ 
		skills["Salvaging"].is_hidden = true;
                update_displayed_skill_bar(skills["Salvaging"], true);
                hidden_skills.push("Salvaging");
		     add_xp_to_skill({
                skill: skills["Scrap Mechanic"],
                xp_to_add: 100,
                should_info: true,
                add_to_parent: false,
                use_bonus: false,
                use_pairing: false
            })
				log_message("Skill EVOLUTION. Salvaging evolved into Scrap Mechanic", "skill_evolution");
}

if(skill.skill_id === "Herbalism" && skill.current_level > 17 && skills["Farming"].current_level == 10 && skills["Foraging"].current_level == 0){ 
		skills["Farming"].is_hidden = true;
                update_displayed_skill_bar(skills["Farming"], true);
               hidden_skills.push("Farming");
		     add_xp_to_skill({
                skill: skills["Foraging"],
                xp_to_add: 100,
                should_info: true,
                add_to_parent: false,
                use_bonus: false,
                use_pairing: false
            })
				log_message("Skill EVOLUTION. Farming evolved into Foraging", "skill_evolution");
}

}

function check_pairings(skill) {
    // Helper to prevent repeated evolution
    function evolve_if_needed({conditions, evolved_skill_id, involved_skills, xp_source_skill, log_text}) {
        const evolved_skill = skills[evolved_skill_id];
        if (evolved_skill.was_evolved) return;

        if (conditions() && evolved_skill.current_level === 0) {
            evolved_skill.was_evolved = true;

            log_message(log_text, "skill_evolution");
            paired_skill_sets.push(new Set([...involved_skills, evolved_skill_id]));

            involved_skills.forEach(id => {
                skills[id].is_hidden = true;
                update_displayed_skill_bar(skills[id], true);
                hidden_skills.push(id);
            });

            const xp_to_grant = Array.isArray(xp_source_skill)
                ? Math.max(...xp_source_skill.map(id => skills[id].total_xp))
                : skills[xp_source_skill].total_xp;

            add_xp_to_skill({
                skill: evolved_skill,
                xp_to_add: xp_to_grant,
                should_info: true,
                add_to_parent: false,
                use_bonus: false,
                use_pairing: false
            });
        }
    }

    // Integrated Weapons Mastery
    if (skill.category === "Weapon" && skill.current_level > 14) {
        evolve_if_needed({
            conditions: () => ["Axes", "Swords", "Spears", "Hammers", "Daggers", "Unarmed"].every(id => skills[id].current_level > 14),
            evolved_skill_id: "Integrated Weapons Mastery",
            involved_skills: ["Axes", "Swords", "Spears", "Hammers", "Daggers", "Unarmed", "Weapon mastery"],
            xp_source_skill: "Weapon mastery",
            log_text: "Skill EVOLUTION. Axe Combat, Hammer Combat, Dagger Combat, Spearmanship, Swordsmanship, Unarmed and Weapons Mastery combined into Integrated Weapons Mastery"
        });
    }

    // Thermal resistance
    if ((skill.skill_id === "Cold resistance" || skill.skill_id === "Heat resistance") && skill.current_level > 10) {
        evolve_if_needed({
            conditions: () => skills["Cold resistance"].current_level > 10 && skills["Heat resistance"].current_level > 10,
            evolved_skill_id: "Thermal resistance",
            involved_skills: ["Cold resistance", "Heat resistance"],
            xp_source_skill: ["Cold resistance", "Heat resistance"],
            log_text: "Skill EVOLUTION. Cold resistance and Heat resistance combined into Thermal resistance"
        });
    }

    // Deadliness
    if ((skill.skill_id === "Obliteration" || skill.skill_id === "Criticality") && skill.current_level > 10) {
        evolve_if_needed({
            conditions: () => skills["Obliteration"].current_level > 10 && skills["Criticality"].current_level > 10,
            evolved_skill_id: "Deadliness",
            involved_skills: ["Criticality", "Obliteration"],
            xp_source_skill: ["Criticality", "Obliteration"],
            log_text: "Skill EVOLUTION. Criticality and Obliteration combined into Deadliness"
        });
    }

    // Adaptive combat
    if ((skill.skill_id === "Battling" || skill.skill_id === "Pest killer") && skill.current_level > 14) {
        evolve_if_needed({
            conditions: () => skills["Battling"].current_level > 14 && skills["Pest killer"].current_level > 14 && skills["Giant slayer"].current_level > 14,
            evolved_skill_id: "Adaptive combat",
            involved_skills: ["Battling", "Pest killer", "Giant slayer"],
            xp_source_skill: ["Battling", "Pest killer", "Giant slayer"],
            log_text: "Skill EVOLUTION. Battling, Pest killer and Giant Slayer combined into Adaptive combat"
        });
    }

    // Reactive combat
    if ((skill.skill_id === "Parrying" || skill.skill_id === "Shield blocking") && skill.current_level > 9) {
        evolve_if_needed({
            conditions: () => skills["Parrying"].current_level > 9 && skills["Counterattack"].current_level > 9 && skills["Shield blocking"].current_level > 9,
            evolved_skill_id: "Reactive combat",
            involved_skills: ["Parrying", "Counterattack", "Shield blocking"],
            xp_source_skill: ["Parrying", "Counterattack", "Shield blocking"],
            log_text: "Skill EVOLUTION. Parrying, Counterattack and Shield blocking combined into Reactive combat"
        });
    }
}

let paired_skill_sets = [

];

function get_paired_set(skill_id) {
    return paired_skill_sets.find(set => set.has(skill_id));
}

function get_other_paired_skills(skill_id) {
    const set = get_paired_set(skill_id);
    if (!set) return [];
    return Array.from(set).filter(id => id !== skill_id);
}

function sync_paired_skills_to_highest(skill_ids) {
    let highest_xp = Math.max(...skill_ids.map(id => skills[id].total_xp));
    for (let id of skill_ids) {
        if (skills[id].total_xp < highest_xp) {
            skills[id].total_xp = highest_xp;
            check_skill_level_vs_flags(skills[id]); // Recheck level/unlocks
			update_displayed_skill_bar(skills[id], true);
        }
    }
}

function getGroupLeaderName(skillName) {
  if (typeof paired_skill_sets === 'undefined' || !Array.isArray(paired_skill_sets)) {
    return skillName;
  }

  for (const set of paired_skill_sets) {
    if (set.has(skillName)) {
      // Get the last item added to the Set (which we assume is the group leader)
      let leader = null;
      for (const item of set) {
        leader = item;
      }
      return leader || skillName;
    }
  }

  return skillName;
}

function containsSet(arrayOfSets, targetSet) {
    // Convert target set to array and sort for consistent comparison
    const targetArray = Array.from(targetSet).sort();
    
    // Check each set in the array
    return arrayOfSets.some(existingSet => {
        const existingArray = Array.from(existingSet).sort();
        return existingArray.length === targetArray.length && 
               existingArray.every((val, index) => val === targetArray[index]);
    });
}


/**
 * adds xp to character, handles levelups
 * @param {Number} xp_to_add 
 * @param {Boolean} should_info 
 */
function add_xp_to_character(xp_to_add, should_info = true, use_bonus) {
    const level_up = character.add_xp({xp_to_add, use_bonus});
    
    if(level_up) {
        if(should_info) {
            log_message(level_up, "level_up");
        }
        
        character.stats.full.health = character.stats.full.max_health; //free healing on level up, because it's a nice thing to have
        update_character_stats();
    }

    update_displayed_character_xp(level_up);
		if(character.xp.current_level >= 10 ){
		 global_flags.is_hero_level10 = true;
	}
		if(character.xp.current_level >= 20 ){
		 global_flags.is_hero_level20 = true;
	}
			if(character.xp.current_level >= 50 ){
		 global_flags.is_hero_level50 = true;
		 
	}
	
}



/**
 * @param {Location} location game Location object
 * @description handles all the rewards for clearing location (both first and subsequent clears), adding xp and unlocking stuff
 */
function get_location_rewards(location) {

    let should_return = false;
    if(location.enemy_groups_killed == location.enemy_count) { //first clear

        if(location.is_challenge) {
            location.is_finished = true;
        }
        should_return = true;
        

        if(location.first_reward.xp && typeof location.first_reward.xp === "number") {
            log_message(`Obtained ${location.first_reward.xp}xp for clearing ${location.name.replace(/\d$/, '')} for the first time`, "location_reward");
            add_xp_to_character(location.first_reward.xp);
        }
    } else if(location.repeatable_reward.xp && typeof location.repeatable_reward.xp === "number") {
        log_message(`Obtained additional ${location.repeatable_reward.xp}xp for clearing ${location.name}`, "location_reward");
        add_xp_to_character(location.repeatable_reward.xp);
    }
	
	if(location.repeatable_reward.skill && typeof location.repeatable_reward.skill === "number") {
        log_message(`Obtained additional ${location.repeatable_reward.skill} ${location.repeatable_reward.related_skill} skill xp for clearing ${location.name}`, "location_reward");
        add_xp_to_skill({skill: skills[location.repeatable_reward.related_skill], xp_to_add: location.repeatable_reward.skill});
    }



    //all below: on each clear, so that if something gets added after location was cleared, it will still be unlockable

    location.otherUnlocks();

    for(let i = 0; i < location.repeatable_reward.locations?.length; i++) { //unlock locations

        if(!location.repeatable_reward.locations[i].required_clears || location.enemy_groups_killed/location.enemy_count >= location.repeatable_reward.locations[i].required_clears){
            unlock_location(locations[location.repeatable_reward.locations[i].location]);
        }
    }
    
    for(let i = 0; i < location.repeatable_reward.flags?.length; i++) {
        global_flags[location.repeatable_reward.flags[i]] = true;
    }

    for(let i = 0; i < location.repeatable_reward.textlines?.length; i++) { //unlock textlines
        var any_unlocked = false;
        for(let j = 0; j < location.repeatable_reward.textlines[i].lines.length; j++) {
            if(dialogues[location.repeatable_reward.textlines[i].dialogue].textlines[location.repeatable_reward.textlines[i].lines[j]].is_unlocked == false) {
                any_unlocked = true;
                dialogues[location.repeatable_reward.textlines[i].dialogue].textlines[location.repeatable_reward.textlines[i].lines[j]].is_unlocked = true;
            }
        }
        if(any_unlocked) {
            log_message(`You should talk to the ${location.repeatable_reward.textlines[i].dialogue.replace(/\d$/, '')}`, "dialogue_unlocked");
            //maybe do this only when there's just 1 dialogue with changes?
        }
    }

    for(let i = 0; i < location.repeatable_reward.dialogues?.length; i++) { //unlocking dialogues
        const dialogue = dialogues[location.repeatable_reward.dialogues[i]]
        if(!dialogue.is_unlocked) {
            dialogue.is_unlocked = true;
            log_message(`You can now talk with the ${dialogue.name}`, "activity_unlocked");
        }
    }

			for (let i = 0; i < location.repeatable_reward.items?.length; i++) {
			const entry = location.repeatable_reward.items[i];
			let itemName, count, quality;

			if (typeof entry === "string") {
				itemName = entry;
				count = 1;
				quality = undefined;
			} else {
				itemName = entry.name;
				count = entry.count || 1;
				quality = entry.quality; // optional
			}

			const baseTemplate = item_templates[itemName];
			if (!baseTemplate) {
				console.warn(`Item "${itemName}" not found in templates.`);
				continue;
			}

			log_message(`${character.name} obtained "${baseTemplate.getName()}" x${count}${quality ? ` (Quality: ${quality})` : ''}`);

			const itemsToAdd = [];
			for (let j = 0; j < count; j++) {
				const itemData = quality != null 
					? getItem({ ...baseTemplate, quality }) 
					: getItem({ ...baseTemplate });
				itemsToAdd.push({ item: itemData });
			}

			add_to_character_inventory(itemsToAdd);
		}

    if(location.repeatable_reward.money && typeof location.repeatable_reward.money === "number") {
        character.money += location.repeatable_reward.money;
        log_message(`${character.name} earned ${format_money(location.repeatable_reward.money)}`);
        update_displayed_money();
    }

	
	
	

    //activities
    for(let i = 0; i < location.repeatable_reward.activities?.length; i++) {
        if(locations[location.repeatable_reward.activities[i].location].activities[location.repeatable_reward.activities[i].activity].tags?.gathering 
            && !global_flags.is_gathering_unlocked) {
                return;
            }

        unlock_activity({location: locations[location.repeatable_reward.activities[i].location].name, 
                            activity: locations[location.repeatable_reward.activities[i].location].activities[location.repeatable_reward.activities[i].activity]});
    }
	

    if(location.repeatable_reward.finish_location) { //finish location
		location.is_finished = true;
		change_location(current_location.parent_location.name);
    }

    if(should_return) {
        change_location(current_location.parent_location.name); //go back to parent location, only on first clear
    }
}

/**
 * 
 * @param location game location object 
 */
function unlock_location(location) {
    if(!location.is_unlocked){
        location.is_unlocked = true;
        const message = location.unlock_text || `Unlocked location ${location.name}`;
        log_message(message, "location_unlocked") 

        //reloads the location (assumption is that a new one was unlocked by clearing a zone)
  if(current_location && !current_dialogue && !current_location_action) {
            change_location(current_location.id);
        }
    }
}



function clear_enemies() {
	if (current_enemies !=	null) {
	for (const enemy of current_enemies) {
    if (typeof enemy.on_save_health === 'function') {
        enemy.on_save_health();
    }
}
	}
	


    current_enemies = null;
}

function use_recipe(target, craft_amount = 1) {
    const category = target.parentNode.parentNode.dataset.crafting_category;
    const subcategory = target.parentNode.parentNode.dataset.crafting_subcategory;
    const recipe_id = target.parentNode.dataset.recipe_id;
    const station_tier = current_location.crafting.tiers[category];

    if (!category || !subcategory || !recipe_id) {
        throw new Error(`Tried to use a recipe but either category, subcategory, or recipe id was not passed: ${category} - ${subcategory} - ${recipe_id}`);
    } else if (!recipes[category][subcategory][recipe_id]) {
        throw new Error(`Tried to use a recipe that doesn't exist: ${category} -> ${subcategory} -> ${recipe_id}`);
    } else {
        const selected_recipe = recipes[category][subcategory][recipe_id];
        const recipe_div = document.querySelector(`[data-crafting_category="${category}"] [data-crafting_subcategory="${subcategory}"] [data-recipe_id="${recipe_id}"]`);
        
if (subcategory === "items") {
    let attempts = 0;
    let leveled = false;
    let success_count = 0;

    const recipe_materials = selected_recipe.materials.map(mat => {
        const material_id = mat.material_id;
        const count_required = mat.count;

        const item_key = Object.keys(character.inventory).find(inv_key => {
            const inv_item = character.inventory[inv_key].item;
            return inv_item && inv_item.id === material_id;
        });

        return item_key ? { item_key, item_count: count_required } : null;
    });

    if (recipe_materials.includes(null)) {
        console.warn("Missing required materials for crafting.");
        return;
    }

    const result = selected_recipe.getResult();
    const { result_id, count } = result;

    while (attempts < craft_amount && selected_recipe.get_availability()) {
        const has_enough = recipe_materials.every(({ item_key, item_count }) =>
            character.inventory[item_key]?.count >= item_count
        );

        if (!has_enough) break;

        total_crafting_attempts++;
        const success_chance = selected_recipe.get_success_chance(station_tier);

        remove_from_character_inventory(recipe_materials);

        const exp_value = get_recipe_xp_value({ category, subcategory, recipe_id });

        if (Math.random() < success_chance) {
            total_crafting_successes++;
            add_to_character_inventory([{ item: item_templates[result_id], count }]);
            success_count++;
            if (craft_amount === 1) {
                log_message(`Created ${item_templates[result_id].getName()} x${count}`, "crafting");
            }
            leveled = add_xp_to_skill({ skill: skills[selected_recipe.recipe_skill], xp_to_add: exp_value });
        } else {
            if (craft_amount === 1) {
                log_message(`Failed to create ${item_templates[result_id].getName()}!`, "crafting");
            }
            leveled = add_xp_to_skill({ skill: skills[selected_recipe.recipe_skill], xp_to_add: exp_value / 2 });
        }

        attempts++;
		if(skills["Scrap Mechanic"].current_level > 0){
		
		 add_xp_to_skill({ skill: skills["Scrap Mechanic"], xp_to_add: exp_value / 5 });
		}
    }

if (craft_amount > 1 && attempts > 0) {
    log_message(`Crafted ${success_count}x [${item_templates[result_id].getName()}]. (${success_count} / ${attempts} success rate)`, "crafting");
}

    update_item_recipe_visibility();
    update_item_recipe_tooltips();
    if (leveled) {
        // TODO: Reload all recipe tooltips of matching category
    }
} else if (subcategory === "components" || selected_recipe.recipe_type === "component") {
    const material_div = recipe_div.children[1].querySelector(".selected_material");
    if (!material_div) return;

    const material_1_key = material_div.dataset.item_key;
    const { id } = JSON.parse(material_1_key);
    const recipe_material = selected_recipe.materials.find(x => x.material_id === id);

    let attempts = 0;
    let max_quality = 0;
    let max_quality_count = 0;
    let quality_name = "";

    while (attempts < craft_amount && character.inventory[material_1_key]?.count >= recipe_material.count) {
        total_crafting_attempts++;
        total_crafting_successes++;
        const result = selected_recipe.getResult(character.inventory[material_1_key].item, station_tier);
        add_to_character_inventory([{ item: result, count: 1 }]);
        remove_from_character_inventory([{ item_key: material_1_key, item_count: recipe_material.count }]);

        if (craft_amount === 1) {
            log_message(`Created ${result.getName()} [${result.quality}% quality]`, "crafting");
        }

        if (result.quality > max_quality) {
            max_quality = result.quality;
            max_quality_count = 1;
            quality_name = result.getName();
        } else if (result.quality === max_quality) {
            max_quality_count++;
        }

        const exp_value = get_recipe_xp_value({
            category, subcategory, recipe_id,
            material_count: recipe_material.count,
            rarity_multiplier: rarity_multipliers[result.getRarity()],
            result_tier: result.component_tier
        });

        const leveled = add_xp_to_skill({
            skill: skills[selected_recipe.recipe_skill],
            xp_to_add: exp_value
        });

        material_div.classList.remove("selected_material");

        if (character.inventory[material_1_key]) {
            if (recipe_material.count > character.inventory[material_1_key].count) {
                material_div.classList.add("recipe_unavailable");
            }
        } else {
            material_div.remove();
        }

        update_displayed_material_choice({ category, subcategory, recipe_id, refreshing: true });

        attempts++;
    }

if (craft_amount > 1 && attempts > 0) {
    log_message(`Crafted ${attempts}x [${quality_name}].\n\n Highest quality = ${max_quality}% (x ${max_quality_count})`, "crafting");
}
}	else if (subcategory === "equipment") {
    const component_1_key = recipe_div.children[1].children[0].children[1].querySelector(".selected_component")?.dataset.item_key;
    const component_2_key = recipe_div.children[1].children[1].children[1].querySelector(".selected_component")?.dataset.item_key;

    let attempts = 0;
    let max_quality = 0;
    let max_quality_count = 0;
    let quality_name = "";

    while (
        attempts < craft_amount &&
        component_1_key &&
        component_2_key &&
        character.inventory[component_1_key] &&
        character.inventory[component_2_key]
    ) {
        total_crafting_attempts++;
        total_crafting_successes++;
        const result = selected_recipe.getResult(
            character.inventory[component_1_key].item,
            character.inventory[component_2_key].item,
            station_tier
        );

        remove_from_character_inventory([{ item_key: component_1_key }, { item_key: component_2_key }]);
        add_to_character_inventory([{ item: result }]);

        if (craft_amount === 1) {
            log_message(`Created ${result.getName()} [${result.quality}% quality]`, "crafting");
        }

        if (result.quality > max_quality) {
            max_quality = result.quality;
            max_quality_count = 1;
            quality_name = result.getName();
        } else if (result.quality === max_quality) {
            max_quality_count++;
        }

        const id_1 = JSON.parse(component_1_key).id;
        const id_2 = JSON.parse(component_2_key).id;

        const exp_value = get_recipe_xp_value({
            category, subcategory, recipe_id,
            selected_components: [item_templates[id_1], item_templates[id_2]],
            rarity_multiplier: rarity_multipliers[result.getRarity()]
        });

        const leveled = add_xp_to_skill({ skill: skills[selected_recipe.recipe_skill], xp_to_add: exp_value });

        const component_keys = {};
        component_keys[component_1_key] = true;
        component_keys[component_2_key] = true;

        update_displayed_component_choice({ category, recipe_id, component_keys });

        attempts++;
    }

if (craft_amount > 1 && attempts > 0) {
    log_message(`Crafted ${attempts}x [${quality_name}].\n\n Highest quality = ${max_quality}% (x ${max_quality_count})`, "crafting");
}
}
	}
}

function character_equip_item(item_key) {
    equip_item_from_inventory(item_key);
    if(current_enemies) {
        reset_combat_loops();
    }
}
function character_unequip_item(item_slot) {
    unequip_item(item_slot);
    if(current_enemies) {
        reset_combat_loops();
        //set_new_combat({enemies: current_enemies});
    }
}

function use_item(item_key) {
    const { id } = JSON.parse(item_key);
    const item = item_templates[id];	
    if (item.tags?.loot_chest) {
        open_loot_chest(item_key);
        return;
    }

    const item_effects = item.effects;
    const gluttony_value = item.gluttony_value;
    const mana_value = item.mana_value;
    const cures = item.cures || [];
    const instant_heal = item.instant_health_recovery || 0;
    const elixir_bonus = item.elixir_bonus || {};

    add_xp_to_skill({ skill: skills["Gluttony"], xp_to_add: gluttony_value });
    add_xp_to_skill({ skill: skills["Mana Expansion"], xp_to_add: mana_value });

    if (id === "Dragon Heart") {
        add_xp_to_skill({ skill: skills["Dragon Heart"], xp_to_add: 1.3, use_bonus: false });
    }
    if (id === "Symbiote") {
        add_xp_to_skill({ skill: skills["Symbiote"], xp_to_add: 1.6, use_bonus: false });
    }
	if (id === "Grilled goo") {
        grilled_goo_eaten++;
    }

    let used = false;

    // Cures
    if (cures.length > 0) {
        cures.forEach(effectName => {
            if (active_effects[effectName]) {
                delete active_effects[effectName];
                used = true;
            }
        });
        update_displayed_effects();
        character.stats.add_active_effect_bonus();
        update_character_stats();
        update_displayed_stats();
    }

    // Effects
    for (let i = 0; i < item_effects.length; i++) {
        const duration = item_effects[i].duration;
        if (!active_effects[item_effects[i].effect] || active_effects[item_effects[i].effect].duration < duration) {
            active_effects[item_effects[i].effect] = new ActiveEffect({
                ...effect_templates[item_effects[i].effect],
                duration
            });
            used = true;
        }
    }

    // Instant health recovery (only apply if not at full health)
    const current_hp = character.stats.full.health;
    const max_hp = character.stats.full.max_health;

    if (instant_heal > 0 && current_hp < max_hp) {
        character.stats.full.health = Math.min(max_hp, current_hp + instant_heal);
        used = true;
    }

    // Elixir stat bonus
    if (elixir_bonus.stats && Object.keys(elixir_bonus.stats).length > 0) {
        character.stats.add_elixir_bonus({ stats: elixir_bonus.stats });
        update_character_stats();
        update_displayed_stats();
        used = true;
    }

    // Apply effect visuals if any applied
    if (used) {
        update_displayed_effects();
        character.stats.add_active_effect_bonus();
        update_character_stats();
        update_displayed_stats();
        remove_from_character_inventory([{ item_key }]);
    }
}

function open_loot_chest(item_key) {
	add_xp_to_skill({skill: skills["Lockpicking"], xp_to_add: 20});
    const { id } = JSON.parse(item_key);
    const chest = item_templates[id];
    if (!chest || (!Array.isArray(chest.loot) && !chest.loot_pool)) {
        console.error(`Invalid loot chest: ${id}`);
        return;
    }

    const itemsToAdd = [];
    const lootMap = new Map(); // Map<item_id, { item, count }>
    let totalMoney = 0;

	let finalLoot = [...(chest.loot || [])];

	// Handle loot pool (if exists)
	if (chest.loot_pool) {
		
		const poolResult = roll_loot_pool(chest.loot_pool);
		if (poolResult.length > 0) {
		
			finalLoot = [...finalLoot, ...poolResult]; // append without mutating chest
		}
	}

    // Regular loot
    for (const lootEntry of finalLoot) {
        const roll = Math.random() * 100;
        if (roll > lootEntry.chance) continue;

        // MONEY ENTRY
        if (lootEntry.money) {
            const amount = Math.floor(
                Math.random() * (lootEntry.max_amount - lootEntry.min_amount + 1)
            ) + lootEntry.min_amount;
            totalMoney += amount;
            continue;
        }

        // ITEM ENTRY
        const count = Math.floor(
            Math.random() * (lootEntry.max_count - lootEntry.min_count + 1)
        ) + lootEntry.min_count;

        for (let i = 0; i < count; i++) {
            const item = getItem(item_templates[lootEntry.item_id]);
            const key = item.getInventoryKey();
            itemsToAdd.push({ item, item_key: key });
        }

        // Update loot map for logging
        const existing = lootMap.get(lootEntry.item_id);
        if (existing) {
            existing.count += count;
        } else {
            lootMap.set(lootEntry.item_id, {
                item: getItem(item_templates[lootEntry.item_id]),
                count: count
            });
        }
    }

    // Award Items
    if (itemsToAdd.length > 0) {
        add_to_character_inventory(itemsToAdd);
    }

    // Award Money
    if (totalMoney > 0) {
        add_money_to_character(totalMoney);
        log_message(`${character.name} earned ${format_money(totalMoney)}`);
    }

    // Log result
    if (lootMap.size > 0) {
        const loot_list = Array.from(lootMap.values());
        log_loot(loot_list, false);
    } else {
        log_message(`You opened the ${chest.name}, but it was empty.`);
    }

    remove_from_character_inventory([{ item_key }]);
}

function roll_loot_pool({ name, rolls, count, chance }) {
    const pool = loot_pools[name];
    if (!Array.isArray(pool)) {
        console.error(`Loot pool "${name}" not found or invalid.`);
        return [];
    }

    const additionalLoot = [];

    for (let i = 0; i < rolls; i++) {
        if (Math.random() * 100 > chance) continue;

        const entry = pool[Math.floor(Math.random() * pool.length)];
        if (!entry || !entry.item_id || !entry.chance) continue;

        if (Math.random() * 100 > entry.chance) continue;

        additionalLoot.push({
            item_id: entry.item_id,
            chance: 100,
            min_count: count,
            max_count: count
        });
    }

    return additionalLoot;
}


function get_date() {
    const date = new Date();
    const year = date.getFullYear();
    const month_num = date.getMonth()+1;
    const month = month_num > 9 ? month_num.toString() : "0" + month_num.toString();
    const day = date.getDate() > 9 ? date.getDate().toString() : "0" + date.getDate().toString();
    const hour = date.getHours() > 9 ? date.getHours().toString() : "0" + date.getHours().toString();
    const minute = date.getMinutes() > 9 ? date.getMinutes().toString() : "0" + date.getMinutes().toString();
    const second = date.getSeconds() > 9 ? date.getSeconds().toString() : "0" + date.getSeconds().toString();
    return `${year}-${month}-${day} ${hour}_${minute}_${second}`;
}

function is_on_dev() {
    return window.location.href.endsWith("-dev/");
}

function is_JSON(str) {
    try {
        return (JSON.parse(str) && !!str);
    } catch (e) {
        return false;
    }
}

/**
 * puts all important stuff into a string
 * @returns string with save data
 */
 
 function regress() {
	 
	 const base_xp_cost = 10;
character.xp = {
        current_level: 0, total_xp: 0, current_xp: 0, xp_to_next_lvl: base_xp_cost, 
        total_xp_to_next_lvl: base_xp_cost, base_xp_cost: base_xp_cost, xp_scaling: 1.4
};
	 
	 
	     character.equipment = {
        head: null, torso: null,
        arms: null, ring: null,
        weapon: null, "off-hand": null,
        legs: null, feet: null,
        amulet: null, artifact: null,
        axe: null, pickaxe: null,
        sickle: null, rod: null
    };

    // Clear inventory
        character.inventory = {}; 
		character.money = 102;
    
	         update_displayed_equipment();
                update_displayed_character_inventory();
                character.stats.add_all_equipment_bonus();
				update_displayed_character_xp();
				update_character_stats();
				update_displayed_money();
//dialogues = {}; This doesn't work. Will need a smarter method for dialogues/locations/activities
//locations = {};
//activities = {};


	//change_location("Burial Chamber");
 }
 
 
function create_save() {
    try{
        const save_data = {};
        save_data["game version"] = game_version;
        save_data["current time"] = current_game_time;
        save_data.saved_at = get_date();
        save_data.total_playtime = total_playtime;
        save_data.total_deaths = total_deaths;
		save_data.total_suicides = total_suicides;
		save_data.enviromental_deaths = enviromental_deaths;
        save_data.total_crafting_attempts = total_crafting_attempts;
        save_data.total_crafting_successes = total_crafting_successes;
        save_data.total_kills = total_kills;
		save_data.grilled_goo_eaten = grilled_goo_eaten;
		save_data.gathered_materials = gathered_materials;
        save_data.global_flags = global_flags;
		save_data.global_battle_state = global_battle_state;
        save_data["character"] = {
                                name: character.name, titles: character.titles, 
                                inventory: {}, equipment: character.equipment,
                                money: character.money, 
                                xp: {
                                total_xp: character.xp.total_xp,
                                },
                                hp_to_full: character.stats.full.max_health - character.stats.full.health,
                                stamina_to_full: character.stats.full.max_stamina - character.stats.full.stamina
                            };
        //no need to save all stats; on loading, base stats will be taken from code and then additional stuff will be calculated again (in case anything changed)
        Object.keys(character.inventory).forEach(key =>{
            save_data["character"].inventory[key] = {count: character.inventory[key].count};
        });
       
        //Object.keys(character.equipment).forEach(key =>{
            //save_data["character"].equipment[key] = true;
            //todo: need to rewrite equipment loading first
        //});
		save_data["favourite_consumables"] = favourite_consumables;

        save_data["skills"] = {};
        Object.keys(skills).forEach(function(key) {
            if(!skills[key].is_parent)
            {
                save_data["skills"][skills[key].skill_id] = {total_xp: skills[key].total_xp}; 
                //a bit redundant, but keep it in case key in skills is different than skill_id
            }
        }); //only save total xp of each skill, again in case of any changes
        
        save_data["current location"] = current_location.name;

        save_data["locations"] = {};
        Object.keys(locations).forEach(function(key) { 
            save_data["locations"][key] = {};
            if(locations[key].is_unlocked) {      
                save_data["locations"][key].is_unlocked = true;
            }
            if(locations[key].is_finished) {      
                save_data["locations"][key].is_finished = true;
            }

            if("parent_location" in locations[key]) { //combat zone
                save_data["locations"][key]["enemy_groups_killed"] = locations[key].enemy_groups_killed;
            }

            if(locations[key].activities) {
                save_data["locations"][key]["unlocked_activities"] = []
                Object.keys(locations[key].activities).forEach(activity_key => {
                    if(locations[key].activities[activity_key].is_unlocked) {
                        save_data["locations"][key]["unlocked_activities"].push(activity_key);
                    }
                });
            }
		            if(locations[key].actions) {
                save_data["locations"][key]["actions"] = {};
                Object.keys(locations[key].actions).forEach(action_key => {
                    if(locations[key].actions[action_key].is_unlocked || locations[key].actions[action_key].is_finished) {
                        save_data["locations"][key]["actions"][action_key] = {};

                        if(locations[key].actions[action_key].is_unlocked) {
                            save_data["locations"][key]["actions"][action_key].is_unlocked = true;
                        }
                        if(locations[key].actions[action_key].is_finished) {
                            save_data["locations"][key]["actions"][action_key].is_finished = true;
                        }
                    }
                    
                });
            }	
			
			
        }); //save locations' (and their activities') unlocked status and their killcounts

        save_data["activities"] = {};
        Object.keys(activities).forEach(function(activity) {
            if(activities[activity].is_unlocked) {
                save_data["activities"][activity] = {is_unlocked: true};
            }
        }); //save activities' unlocked status (this is separate from unlock status in location)

    if(current_activity) {
            save_data["current_activity"] = {activity_id: current_activity.id, 
                                             working_time: current_activity.working_time, 
                                             earnings: current_activity.earnings,
                                             gathering_time: current_activity.gathering_time,
                                             gathered_materials: current_activity.gathered_materials,
                                            };
        }
        
        save_data["dialogues"] = {};
        Object.keys(dialogues).forEach(function(dialogue) {
            save_data["dialogues"][dialogue] = {is_unlocked: dialogues[dialogue].is_unlocked, is_finished: dialogues[dialogue].is_finished, textlines: {}};
            if(dialogues[dialogue].textlines) {
                Object.keys(dialogues[dialogue].textlines).forEach(function(textline) {
                    save_data["dialogues"][dialogue].textlines[textline] = {is_unlocked: dialogues[dialogue].textlines[textline].is_unlocked,
                                                                is_finished: dialogues[dialogue].textlines[textline].is_finished};
                });
            }
        }); //save dialogues' and their textlines' unlocked/finished statuses

        save_data["traders"] = {};
        Object.keys(traders).forEach(function(trader) {
            if(traders[trader].is_unlocked) {
                if(traders[trader].last_refresh == -1 || traders[trader].can_refresh()) {
                    //no need to save inventory, as trader would be anyway refreshed on any visit
                    save_data["traders"][trader] = {last_refresh: -1,
                                                    is_unlocked: traders[trader].is_unlocked};
                } else {
                    const t_inventory = {};
                    Object.keys(traders[trader].inventory).forEach(key =>{
                        t_inventory[key] = {count: traders[trader].inventory[key].count};
                    });
                    save_data["traders"][trader] = {inventory: t_inventory, 
                                                    last_refresh: traders[trader].last_refresh, 
                                                    is_unlocked: traders[trader].is_unlocked
                                                };
                }
            }
        });

        save_data["books"] = {};
        Object.keys(book_stats).forEach(book => {
            if(book_stats[book].accumulated_time > 0 || book_stats[book].is_finished) {
                //check both conditions, on loading set as finished if either 'is_finished' or has enough time accumulated
                save_data["books"][book] = {
                    accumulated_time: book_stats[book].accumulated_time,
                    is_finished: book_stats[book].is_finished
                };
            }
        });
		
		if(is_reading != null) {
        save_data["is_reading"] = JSON.stringify({ id: is_reading });
		} else 
		{
		save_data["is_reading"] = is_reading;}

        save_data["is_sleeping"] = is_sleeping;

        save_data["active_effects"] = active_effects;

        save_data["enemy_killcount"] = enemy_killcount;

        save_data["loot_sold_count"] = loot_sold_count;

        save_data["last_combat_location"] = last_combat_location;
        save_data["last_location_with_bed"] = last_location_with_bed;

        save_data["options"] = options;

        save_data["stances"] = {};
        Object.keys(stances).forEach(stance => {
            if(stances[stance].is_unlocked) {
                save_data["stances"][stance] = true;
            }
        }) 
        save_data["current_stance"] = current_stance;
        save_data["selected_stance"] = selected_stance;
        save_data["faved_stances"] = faved_stances;

		save_data["magics"] = {};
			Object.keys(magics).forEach(magic => {
			if (magics[magic].is_unlocked) {
        save_data["magics"][magic] = {
            unlocked: true,
            auto_cast: !!magics[magic].auto_cast
        };
			}
			
		save_data["magic_cooldowns"] = magic_cooldowns;
		
		save_data["current_party"] = current_party;
		
		save_data["active_quests"] = active_quests;
		save_data["finished_quests"] = finished_quests;
		save_data["visited_locations"] = visited_locations;
		
		save_data["hidden_skills"] = hidden_skills;
		save_data["paired_skill_sets"] = paired_skill_sets.map(set => Array.from(set));
		
		save_data["used_elixirs"] = {};

		for (const stat in character.stats.flat.elixirs) {
			if (character.stats.flat.elixirs[stat] > 0) {
				save_data["used_elixirs"][stat] = character.stats.flat.elixirs[stat];
			}
		}
		
			
});

        save_data["message_filters"] = {
            unlocks: document.documentElement.style.getPropertyValue('--message_unlocks_display') !== "none",
            events: document.documentElement.style.getPropertyValue('--message_events_display') !== "none",
            combat: document.documentElement.style.getPropertyValue('--message_combat_display') !== "none",
            loot: document.documentElement.style.getPropertyValue('--message_loot_display') !== "none",
            background: document.documentElement.style.getPropertyValue('--message_background_display') !== "none",
            crafting: document.documentElement.style.getPropertyValue('--message_crafting_display') !== "none",
			rare: document.documentElement.style.getPropertyValue('--message_rare_loot_display') !== "none",
        };

        return JSON.stringify(save_data);
    } catch(error) {
        console.error("Something went wrong on saving the game!");
        console.error(error);
        log_message("FAILED TO CREATE A SAVE FILE, PLEASE CHECK CONSOLE FOR ERRORS AND REPORT IT", "message_critical");
    }
} 

function add_consumable_to_favourites(item_id) {
    if(!item_templates[item_id]) {
        throw new Error(`Tried to add "${item_id}" to auto consume, but no such item exists.`);
    } else if(!item_templates[item_id].tags.usable) {
        throw new Error(`Tried to add "${item_id}" to auto consume, but it's not a consumable.`);
    }
    favourite_consumables[item_id] = true;
    //update autouse button display? currently done in .html
}

function remove_consumable_from_favourites(item_id) {
    if(!favourite_consumables[item_id]) {
        throw new Error(`Tried to remove "${item_id}" from auto consume, but it's not there.`);
    }
    delete favourite_consumables[item_id];
    if(character.inventory[item_templates[item_id].getInventoryKey()]) {
        //update autouse button display? currently done in .html
    }
}

function change_consumable_favourite_status(item_id) {
    if(!item_templates[item_id]) {
        throw new Error(`Tried to change "${item_id}" auto consum status, but no such item exists.`);
    } else if(!item_templates[item_id].tags.usable) {
        throw new Error(`Tried to change "${item_id}" auto consume status, but it's not a consumable.`);
    }

    if(favourite_consumables[item_id]) {
        remove_consumable_from_favourites(item_id);
    } else {
        add_consumable_to_favourites(item_id);
    }

    if(character.inventory[item_templates[item_id].getInventoryKey()]) {
        //update autouse button display? currently done in .html
    }
}
/**
 * called from index.html
 * @returns save string encoded to base64
 */
function save_to_file() {
    return btoa(create_save());
}

/**
 * saves game state to localStorage, on manual saves also logs message about it being done
 * @param {Boolean} is_manual 
 */
function save_to_localStorage({key, is_manual}) {
    const save = create_save();
    if(save) {
        localStorage.setItem(key, save);
    }
    
    if(is_manual) {
        log_message("Saved the game manually");
        save_counter = 0;
    }

    return JSON.parse(save).saved_at;
}

function save_progress() {
    if(is_on_dev()) {
        save_to_localStorage({key: dev_save_key, is_manual: true});
    } else {
        save_to_localStorage({key: save_key, is_manual: true});
    }
}

function load(save_data) {
    //single loading method
    
    //current enemies are not saved

    current_game_time.load_time(save_data["current time"]);
    time_field.innerHTML = current_game_time.toString();
    //set game time

    Object.keys(save_data.global_flags||{}).forEach(flag => {
        global_flags[flag] = save_data.global_flags[flag];
    });

global_battle_state = save_data.global_battle_state || {};


    total_playtime = save_data.total_playtime || 0;
    total_deaths = save_data.total_deaths || 0;
	total_suicides = save_data.total_suicides || 0;
	enviromental_deaths = save_data.enviromental_deaths || 0;
    total_crafting_attempts = save_data.total_crafting_attempts || 0;
    total_crafting_successes = save_data.total_crafting_successes || 0;
    total_kills = save_data.total_kills || 0;
	gathered_materials = save_data.gathered_materials || {};
	grilled_goo_eaten = save_data.grilled_goo_eaten || 0;

    name_field.value = save_data.character.name;
    character.name = save_data.character.name;

    last_location_with_bed = save_data.last_location_with_bed;
    last_combat_location = save_data.last_combat_location;

    options.uniform_text_size_in_action = save_data.options?.uniform_text_size_in_action;
    option_uniform_textsize(options.uniform_text_size_in_action);

    options.auto_return_to_bed = save_data.options?.auto_return_to_bed;
    option_bed_return(options.auto_return_to_bed);

    options.disable_combat_autoswitch = save_data.options?.disable_combat_autoswitch;
    option_combat_autoswitch(options.disable_combat_autoswitch);

    options.remember_message_log_filters = save_data.options?.remember_message_log_filters;
    if(save_data.message_filters) {
        Object.keys(message_log_filters).forEach(filter => {
            message_log_filters[filter] = save_data.message_filters[filter] ?? true;
        })
    }
    option_remember_filters(options.remember_message_log_filters);
	
	option_log_gathering_result(options.log_total_gathering_gain);

    //this can be removed at some point
    const is_from_before_eco_rework = compare_game_version("v0.3.5", save_data["game version"]) == 1;
    setLootSoldCount(save_data.loot_sold_count || {});

    character.money = (save_data.character.money || 0) * ((is_from_before_eco_rework == 1)*10 || 1);
    update_displayed_money();

    
	
	    Object.keys(save_data.favourite_consumables || {}).forEach(key => {
        favourite_consumables[key] = true;
    });

	hidden_skills = save_data.hidden_skills || [];
	

			Object.keys(save_data.skills).forEach(function(key){ 
				if(key === "Literacy") {
					return; //done separately, for compatibility with older saves (can be eventually remove)
				}
				if (skills[key] && !skills[key].is_parent) {
					// Restore hidden state
					if (hidden_skills.includes(key)) {
						skills[key].is_hidden = true;
						skills[key].parent_skill = null;
					} else {
						skills[key].is_hidden = false;
					}

					// Restore XP
					if (save_data.skills[key].total_xp > 0) {
						add_xp_to_skill({
							skill: skills[key],
							xp_to_add: save_data.skills[key].total_xp,
							should_info: false,
							add_to_parent: true,
							use_bonus: false,
							use_pairing: false
						});
						
						// Check for specific skills with >50 XP
		
					}

					// Reflect in UI
					
				} else if (save_data.skills[key].total_xp > 0) {
					console.warn(`Skill "${key}" couldn't be found!`);
				}
			}); //add	
	
	
					if (save_data.skills["Integrated Weapons Mastery"] && save_data.skills["Integrated Weapons Mastery"]?.total_xp > 50) {
							update_displayed_skill_description(skills["Integrated Weapons Mastery"]);
						}
						if (save_data.skills["Thermal resistance"] && save_data.skills["Thermal resistance"]?.total_xp > 50) {
							update_displayed_skill_description(skills["Thermal resistance"]);
						}
	
	character.recalculate_xp_thresholds();
	add_xp_to_character(save_data.character.xp.total_xp, false);
	
    if(save_data.books) {
        let total_book_xp = 0;
        const literacy_xp = save_data.skills["Literacy"].total_xp;
        Object.keys(save_data.books).forEach(book=>{
            if(!item_templates[book]) {
                console.warn(`Book ${book} couldn't be found and was skipped!`);
            }

           if (save_data.books[book].accumulated_time > 0) {
		if (save_data.books[book].is_finished) {
					item_templates[book].setAsFinished(true); // Pass true to prevent unlocks
                    total_book_xp += book_stats[book].required_time * book_stats[book].literacy_xp_rate;
                } else {
                    item_templates[book].addProgress(save_data.books[book].accumulated_time);
                    total_book_xp += book_stats[book].accumulated_time * book_stats[book].literacy_xp_rate;
                }
            }
        });
        if(total_book_xp > literacy_xp) {
            add_xp_to_skill({skill: skills["Literacy"], should_info: false, xp_to_add: total_book_xp, use_bonus: false});
            console.warn(`Saved XP for "Literacy skill" was less than it should be based on progress with books (${literacy_xp} vs ${total_book_xp}), so it was adjusted to match it!`);
        } else {
            add_xp_to_skill({skill: skills["Literacy"], should_info: false, xp_to_add: literacy_xp, use_bonus: false});
        }
    }
	
	paired_skill_sets = (save_data.paired_skill_sets || []).map(arr => new Set(arr));
	

// Correction for weapon set.
const weaponsSet = new Set(["Axes","Swords","Spears","Hammers","Daggers","Unarmed","Integrated Weapons Mastery"]);
if (skills["Integrated Weapons Mastery"].current_level > 0 && !containsSet(paired_skill_sets, weaponsSet)) {
    paired_skill_sets.push(weaponsSet);
}

// Correction for resistance set
const resistanceSet = new Set(["Cold resistance", "Heat resistance","Thermal resistance"]);
if (skills["Thermal resistance"].current_level > 0 && !containsSet(paired_skill_sets, resistanceSet)) {
    paired_skill_sets.push(resistanceSet);
}
	
	
		
    if(save_data["stances"]) {
        Object.keys(save_data["stances"]).forEach(stance => {
            if(save_data["stances"]) {
                stances[stance].is_unlocked = true;
            } 
        });
    }
    update_displayed_stance_list();
    if(save_data.current_stance) {
        current_stance = save_data.current_stance;
        selected_stance = save_data.selected_stance;
        change_stance(selected_stance);
    }
    
    if(save_data.faved_stances) {
        Object.keys(save_data.faved_stances).forEach(stance_id=> {
            if(stances[stance_id] && stances[stance_id].is_unlocked) {
                fav_stance(stance_id);
            }
        });
    }
	if(save_data["magics"]) {
        Object.keys(save_data["magics"]).forEach(magic => {
            if(save_data["magics"]) {
                magics[magic].is_unlocked = true;
            } 
        });
    }
	
	if(save_data.magic_cooldowns) {
		 magic_cooldowns = save_data["magic_cooldowns"];
    }
	
if (save_data.current_party) {
    // Optionally clear current_party first (if it's not already empty)
    current_party.length = 0; // Clears the array while keeping it const
    
    // Re-add each ally from save_data with messages suppressed
    save_data.current_party.forEach(ally_id => {
        add_allies_to_party(ally_id, true); // true suppresses messages
    });
}
	
	
		if (save_data.active_quests) {
		  active_quests = save_data.active_quests.map(q => ({
			...q, // Keep all saved properties
			getQuestName: () => q.quest_name // Reattach the missing method
		  }));
		}
		
		if(save_data.finished_quests) {
		 finished_quests = save_data["finished_quests"];
    }
	
	
		if(save_data.visited_locations) {
		 visited_locations = save_data["visited_locations"];
    }
	
	
	
    
    populateQuestList(active_quests); 
	
	
	
    update_displayed_magic_list();

    Object.keys(save_data.character.equipment).forEach(function(key){
        if(save_data.character.equipment[key] != null) {
            const quality_mult = compare_game_version("v0.4.4", save_data["game version"]) == 1?100:1; //x100 if its from before quality rework
            try{
                if(key === "weapon") {
                    const {quality, equip_slot} = save_data.character.equipment[key];
                    let components;
                    if(save_data.character.equipment[key].components) {
                        components = save_data.character.equipment[key].components
                    } else {
                        const {head, handle} = save_data.character.equipment[key];
                        components = {head, handle};
                    }

                    if(!item_templates[components.head]){
                        console.warn(`Skipped item: weapon head component "${components.head}" couldn't be found!`);
                    } else if(!item_templates[components.handle]) {
                        console.warn(`Skipped item: weapon handle component "${components.handle}" couldn't be found!`);
                    } else {
                        const item = getItem({components, quality:quality*quality_mult, equip_slot, item_type: "EQUIPPABLE"});
                        equip_item(item);
                    }
                } else if(key === "off-hand") {
                    const {quality, equip_slot} = save_data.character.equipment[key];
                    let components;
                    if(save_data.character.equipment[key].components) {
                        components = save_data.character.equipment[key].components
                    } else {
                        const {shield_base, handle} = save_data.character.equipment[key];
                        components = {shield_base, handle};
                    }

                    if(!item_templates[components.shield_base]){
                        console.warn(`Skipped item: shield base component "${components.shield_base}" couldn't be found!`);
                    } else if(!item_templates[components.handle]) {
                        console.warn(`Skipped item: shield handle "${components.handle}" couldn't be found!`);
                    } else {
                        const item = getItem({components, quality:quality*quality_mult, equip_slot, item_type: "EQUIPPABLE"});
                        equip_item(item);
                    }
                } else if(save_data.character.equipment[key].equip_slot === "arti'fact" || save_data.character.equipment[key].tags?.tool) {
                    equip_item(getItem(save_data.character.equipment[key]));
                } else { //armor
                    
                    const {quality, equip_slot} = save_data.character.equipment[key];
                    
                    if(save_data.character.equipment[key].components && save_data.character.equipment[key].components.internal.includes(" [component]")) {
                        //compatibility for armors from before v0.4.3
                        const item = getItem({...item_templates[save_data.character.equipment[key].components.internal.replace(" [component]","")], quality:quality*quality_mult});
                        equip_item(item);
                    }
                    else if(save_data.character.equipment[key].components) {
                        let components = save_data.character.equipment[key].components;
                        if(!item_templates[components.internal]){
                            console.warn(`Skipped item: internal armor component "${components.internal}" couldn't be found!`);
                        } else if(components.external && !item_templates[components.external]) {
                            console.warn(`Skipped item: external armor component "${components.external}" couldn't be found!`);
                        } else {
                            const item = getItem({components, quality:quality*quality_mult, equip_slot, item_type: "EQUIPPABLE"});
                            equip_item(item);
                        }
                    } else {
                        const item = getItem({...item_templates[save_data.character.equipment[key].name], quality:quality*quality_mult});
                        equip_item(item);
                    }

                }
            } catch (error) {
                console.error(error);
            }
        }
    }); //equip proper items

    if(character.equipment.weapon === null) {
        equip_item(null);
    }

    const item_list = [];

    Object.keys(save_data.character.inventory).forEach(function(key){
        if(is_JSON(key)) {
            //case where this is False is left as compatibility for saves before v0.4.4
            let {id, components, quality} = JSON.parse(key);
            if(id && !quality) { 
                //id is just a key of item_templates
                //if it's present, item is "simple" (no components)
                //and if it has no quality, it's something non-equippable
                if(item_templates[id]) {
                    item_list.push({item: getItem(item_templates[id]), count: save_data.character.inventory[key].count});
                    
                } else {
                    console.warn(`Inventory item "${key}" from save on version "${save_data["game version"]} couldn't be found!`);
                    return;
                }
            } else if(components) {
                const {head, handle, shield_base, internal, external} = components;
                if(head) { //weapon
                    if(!item_templates[head]){
                        console.warn(`Skipped item: weapon head component "${head}" couldn't be found!`);
                        return;
                    } else if(!item_templates[handle]) {
                        console.warn(`Skipped item: weapon handle component "${handle}" couldn't be found!`);
                        return;
                    } else {
                        const item = getItem({components, quality, equip_slot: "weapon", item_type: "EQUIPPABLE"});
                        item_list.push({item, count: 1});
                    }
                } else if(shield_base){ //shield
                    if(!item_templates[shield_base]){
                        console.warn(`Skipped item: shield base component "${shield_base}" couldn't be found!`);
                        return;
                    } else if(!item_templates[handle]) {
                        console.warn(`Skipped item: shield handle component "${handle}" couldn't be found!`);
                        return;
                    } else {
                        const item = getItem({components, quality, equip_slot: "off-hand", item_type: "EQUIPPABLE"});
                        item_list.push({item, count: 1});
                    }
                } else if(internal) { //armor
                    if(!item_templates[internal]){
                        console.warn(`Skipped item: internal armor component "${internal}" couldn't be found!`);
                        return;
                    } else if(!item_templates[external]) {
                        console.warn(`Skipped item: external armor component "${external}" couldn't be found!`);
                        return;
                    } else {
                        let equip_slot = getArmorSlot(internal);
                        if(!equip_slot) {
                            return;
                        }
                        const item = getItem({components, quality, equip_slot, item_type: "EQUIPPABLE"});
                        item_list.push({item, count: 1});
                    }
                } else {
                    console.error(`Intentory key "${key}" from save on version "${save_data["game version"]} seems to refer to non-existing item type!`);
                }
            } else if(quality) { //no comps but quality (clothing / artifact?)
                const item = getItem({...item_templates[id], quality});
                item_list.push({item, count: save_data.character.inventory[key].count});
            } else {
                console.error(`Intentory key "${key}" from save on version "${save_data["game version"]} is incorrect!`);
            }
            
        } else {
            if(Array.isArray(save_data.character.inventory[key])) { //is a list of unstackable items (equippables or books), needs to be added 1 by 1
                for(let i = 0; i < save_data.character.inventory[key].length; i++) {
                    try{
                        if(save_data.character.inventory[key][i].item_type === "EQUIPPABLE" )
                        {
                            if(save_data.character.inventory[key][i].equip_slot === "weapon") {
                                
                                const {quality, equip_slot} = save_data.character.inventory[key][i];
                                let components;
                                if(save_data.character.inventory[key][i].components) {
                                    components = save_data.character.inventory[key][i].components
                                } else {
                                    const {head, handle} = save_data.character.inventory[key][i];
                                    components = {head, handle};
                                }
    
                                if(!item_templates[components.head]){
                                    console.warn(`Skipped item: weapon head component "${components.head}" couldn't be found!`);
                                } else if(!item_templates[components.handle]) {
                                    console.warn(`Skipped item: weapon handle component "${components.handle}" couldn't be found!`);
                                } else {
                                    const item = getItem({components, quality: quality*100, equip_slot, item_type: "EQUIPPABLE"});
                                    item_list.push({item, count: 1});
                                }
                            } else if(save_data.character.inventory[key][i].equip_slot === "off-hand") {
                                const {quality, equip_slot} = save_data.character.inventory[key][i];
                                let components;
                                if(save_data.character.inventory[key][i].components) {
                                    components = save_data.character.inventory[key][i].components
                                } else {
                                    const {shield_base, handle} = save_data.character.inventory[key][i];
                                    components = {shield_base, handle};
                                }
    
                                if(!item_templates[components.shield_base]){
                                    console.warn(`Skipped item: shield base component "${components.shield_base}" couldn't be found!`);
                                } else if(!item_templates[components.handle]) {
                                    console.warn(`Skipped item: shield handle "${components.handle}" couldn't be found!`);
                                } else {
                                    const item = getItem({components, quality: quality*100, equip_slot, item_type: "EQUIPPABLE"});
                                    item_list.push({item, count: 1});
                                }
                            } else if(save_data.character.inventory[key][i].equip_slot === "artifact") {
                                item_list.push({item: getItem(save_data.character.inventory[key][i]), count: 1});
                            } else { //armor
                                const {quality, equip_slot} = save_data.character.inventory[key][i];
    
                                if(save_data.character.inventory[key][i].components && save_data.character.inventory[key][i].components.internal.includes(" [component]")) {
                                    //compatibility for armors from before v0.4.3
                                    const item = getItem({...item_templates[save_data.character.inventory[key][i].components.internal.replace(" [component]","")], quality: quality});
                                    item_list.push({item, count: 1});
                                }
                                else if(save_data.character.inventory[key][i].components) {
                                    let components = save_data.character.inventory[key][i].components;
                                    if(!item_templates[components.internal]){
                                        console.warn(`Skipped item: internal armor component "${components.internal}" couldn't be found!`);
                                    } else if(components.external && !item_templates[components.external]) {
                                        console.warn(`Skipped item: external armor component "${components.external}" couldn't be found!`);
                                    } else {
                                        const item = getItem({components, quality: quality*100, equip_slot, item_type: "EQUIPPABLE"});
                                        item_list.push({item, count: 1});
                                    }
                                } else {
                                    const item = getItem({...item_templates[save_data.character.inventory[key][i].id], quality: quality*100});
                                    item_list.push({item, count: 1});
                                }
                            }
                        } else {
                            item_list.push({item: getItem({...item_templates[save_data.character.inventory[key][i].id], quality: save_data.character.inventory[key][i].quality*100}), count: 1});
                        }
                    } catch (error) {
                        console.error(error);
                    }
                }
            }
            else { //is stackable 
                if(item_templates[key]) {
                    item_list.push({item: getItem(item_templates[save_data.character.inventory[key].item.name]), count: save_data.character.inventory[key].count});
                } else {
                    console.warn(`Inventory item "${key}" from save on version "${save_data["game version"]}" couldn't be found!`);
                    return;
                }
            }
        }
    }); //add all loaded items to list
    add_to_character_inventory(item_list); // and then to inventory

    Object.keys(save_data.dialogues).forEach(function(dialogue) {
        if(dialogues[dialogue]) {
            dialogues[dialogue].is_unlocked = save_data.dialogues[dialogue].is_unlocked;
            dialogues[dialogue].is_finished = save_data.dialogues[dialogue].is_finished;
        } else {
            console.warn(`Dialogue "${dialogue}" couldn't be found!`);
            return;
        }
        if(save_data.dialogues[dialogue].textlines) {  
            Object.keys(save_data.dialogues[dialogue].textlines).forEach(function(textline){
                if(dialogues[dialogue].textlines[textline]) {
                    dialogues[dialogue].textlines[textline].is_unlocked = save_data.dialogues[dialogue].textlines[textline].is_unlocked;
                    dialogues[dialogue].textlines[textline].is_finished = save_data.dialogues[dialogue].textlines[textline].is_finished;
                } else {
                    console.warn(`Textline "${textline}" in dialogue "${dialogue}" couldn't be found!`);
                    return;
                }
            }); 
        }
    }); //load for dialogues and their textlines their unlocked/finished status

    Object.keys(save_data.traders).forEach(function(trader) { 
        let trader_item_list = [];
        if(traders[trader]){

            //set as unlocked (it must have been unlocked to be saved, so no need to check the actual value)
            traders[trader].is_unlocked = true;

            if(save_data.traders[trader].inventory) {
                Object.keys(save_data.traders[trader].inventory).forEach(function(key){
                    if(is_JSON(key)) {
                        //case where this is False is left as compatibility for saves before v0.4.4
                        let {id, components, quality} = JSON.parse(key);
                        if(id && !quality) { 
                            //id is just a key of item_templates
                            //if it's present, item is "simple" (no components)
                            //and if it has no quality, it's something non-equippable
                            if(item_templates[id]) {
                                trader_item_list.push({item: getItem(item_templates[id]), count: save_data.traders[trader].inventory[key].count});
                            } else {
                                console.warn(`Inventory item "${key}" from save on version "${save_data["game version"]} couldn't be found!`);
                                return;
                            }
                        } else if(components) {
                            const {head, handle, shield_base, internal, external} = components;
                            if(head) { //weapon
                                if(!item_templates[head]){
                                    console.warn(`Skipped item: weapon head component "${head}" couldn't be found!`);
                                    return;
                                } else if(!item_templates[handle]) {
                                    console.warn(`Skipped item: weapon handle component "${handle}" couldn't be found!`);
                                    return;
                                } else {
                                    const item = getItem({components, quality, equip_slot: "weapon", item_type: "EQUIPPABLE"});
                                    trader_item_list.push({item, count: 1});
                                }
                            } else if(shield_base){ //shield
                                if(!item_templates[shield_base]){
                                    console.warn(`Skipped item: shield base component "${shield_base}" couldn't be found!`);
                                    return;
                                } else if(!item_templates[handle]) {
                                    console.warn(`Skipped item: shield handle component "${handle}" couldn't be found!`);
                                    return;
                                } else {
                                    const item = getItem({components, quality, equip_slot: "off-hand", item_type: "EQUIPPABLE"});
                                    trader_item_list.push({item, count: 1});
                                }
                            } else if(internal) { //armor
                                if(!item_templates[internal]){
                                    console.warn(`Skipped item: internal armor component "${internal}" couldn't be found!`);
                                    return;
                                } else if(!item_templates[external]) {
                                    console.warn(`Skipped item: external armor component "${external}" couldn't be found!`);
                                    return;
                                } else {
                                    let equip_slot = getArmorSlot(internal);
                                    if(!equip_slot) {
                                        return;
                                    }
                                    const item = getItem({components, quality, equip_slot, item_type: "EQUIPPABLE"});
                                    trader_item_list.push({item, count: 1});
                                }
                            } else {
                                console.error(`Intentory key "${key}" from save on version "${save_data["game version"]} seems to refer to non-existing item type!`);
                            }
                        } else if(quality) { //no comps but quality (clothing / artifact?)
                            const item = getItem({...item_templates[id], quality});
                            trader_item_list.push({item, count: save_data.traders[trader].inventory[key].count});
                        } else {
                            console.error(`Intentory key "${key}" from save on version "${save_data["game version"]} is incorrect!`);
                        }
                        
                    } else {
                        if(Array.isArray(save_data.traders[trader].inventory[key])) { //is a list of unstackable (equippable or book) item, needs to be added 1 by 1
                            for(let i = 0; i < save_data.traders[trader].inventory[key].length; i++) {
                                try{
                                    if(save_data.traders[trader].inventory[key][i].item_type === "EQUIPPABLE"){
                                        if(save_data.traders[trader].inventory[key][i].equip_slot === "weapon") {
                                            const {quality, equip_slot} = save_data.traders[trader].inventory[key][i];
                                            let components;
                                            if(save_data.traders[trader].inventory[key][i].components) {
                                                components = save_data.traders[trader].inventory[key][i].components
                                            } else {
                                                const {head, handle} = save_data.traders[trader].inventory[key][i];
                                                components = {head, handle};
                                            }
    
                                            if(!item_templates[components.head]){
                                                console.warn(`Skipped item: weapon head component "${components.head}" couldn't be found!`);
                                            } else if(!item_templates[components.handle]) {
                                                console.warn(`Skipped item: weapon handle component "${components.handle}" couldn't be found!`);
                                            } else {
                                                const item = getItem({components, quality: quality*100, equip_slot, item_type: "EQUIPPABLE"});
                                                trader_item_list.push({item, count: 1});
                                            }
                                        } else if(save_data.traders[trader].inventory[key][i].equip_slot === "off-hand") {
                                            
                                            const {quality, equip_slot} = save_data.traders[trader].inventory[key][i];
                                            let components;
                                            if(save_data.traders[trader].inventory[key][i].components) {
                                                components = save_data.traders[trader].inventory[key][i].components
                                            } else {
                                                const {shield_base, handle} = save_data.traders[trader].inventory[key][i];
                                                components = {shield_base, handle};
                                            }
    
                                            if(!item_templates[components.shield_base]){
                                                console.warn(`Skipped item: shield base component "${components.shield_base}" couldn't be found!`);
                                            } else if(!item_templates[components.handle]) {
                                                console.warn(`Skipped item: shield handle "${components.handle}" couldn't be found!`);
                                            } else {
                                                const item = getItem({components, quality: quality*100, equip_slot, item_type: "EQUIPPABLE"});
                                                trader_item_list.push({item, count: 1});
                                            }
                                        } else { //armor
    
                                            const {quality, equip_slot} = save_data.traders[trader].inventory[key][i];
                                            if(save_data.traders[trader].inventory[key][i].components && save_data.traders[trader].inventory[key][i].components.internal.includes(" [component]")) {
                                                //compatibility for armors from before v0.4.3
                                                const item = getItem({...item_templates[save_data.traders[trader].inventory[key][i].components.internal.replace(" [component]","")], quality: quality*100});
                                                trader_item_list.push({item, count: 1});
                                            } else if(save_data.traders[trader].inventory[key][i].components) {
                                                let components = save_data.traders[trader].inventory[key][i].components;
                                                if(!item_templates[components.internal]){
                                                    console.warn(`Skipped item: internal armor component "${components.internal}" couldn't be found!`);
                                                } else if(components.external && !item_templates[components.external]) {
                                                    console.warn(`Skipped item: external armor component "${components.external}" couldn't be found!`);
                                                } else {
                                                    const item = getItem({components, quality: quality*100, equip_slot, item_type: "EQUIPPABLE"});
                                                    trader_item_list.push({item, count: 1});
                                                }
                                            } else {
                                                const item = getItem({...item_templates[save_data.traders[trader].inventory[key][i].name], quality: quality*100});
                                                trader_item_list.push({item, count: 1});
                                            }
                                        }
                                    } else {
                                        console.warn(`Skipped item, no such item type as "${0}" could be found`)
                                    }
                                } catch (error) {
                                    console.error(error);
                                }
                            }
                        }
                        else {
                            save_data.traders[trader].inventory[key].item.value = item_templates[key].value;
                            if(item_templates[key].item_type === "EQUIPPABLE") {
                                save_data.traders[trader].inventory[key].item.equip_effect = item_templates[key].equip_effect;
                            } else if(item_templates[key].item_type === "USABLE") {
                                save_data.traders[trader].inventory[key].item.use_effect = item_templates[key].use_effect;
                            }
                            trader_item_list.push({item: getItem(item_templates[save_data.traders[trader].inventory[key].item.name]), count: save_data.traders[trader].inventory[key].count});
                        }
                    }
                });
                
            }
            traders[trader].refresh(); 
            traders[trader].inventory = {};
            add_to_trader_inventory(trader, trader_item_list);

            traders[trader].last_refresh = save_data.traders[trader].last_refresh; 
        }
        else {
            console.warn(`Trader "${trader} couldn't be found!`);
            return;
        }
    }); //load trader inventories

    Object.keys(save_data.locations).forEach(function(key) {
        if(locations[key]) {
            if(save_data.locations[key].is_unlocked) {
                locations[key].is_unlocked = true;
            }
            if(save_data.locations[key].is_finished) {
                locations[key].is_finished = true;
            }
            if("parent_location" in locations[key]) { // if combat zone
                locations[key].enemy_groups_killed = save_data.locations[key].enemy_groups_killed || 0;   
            }

            //unlock activities
            if(save_data.locations[key].unlocked_activities) {
                for(let i = 0; i < save_data.locations[key].unlocked_activities.length; i++) {
                    if(!locations[key].activities[save_data.locations[key].unlocked_activities[i]]) {
                        continue;
                    }
                    if(save_data.locations[key].unlocked_activities[i] === "plowing the fields") {
                        locations[key].activities["fieldwork"].is_unlocked = true;
                    } else {
                        locations[key].activities[save_data.locations[key].unlocked_activities[i]].is_unlocked = true;
                    }
                }
            }
			            if(save_data.locations[key].actions) {
                Object.keys(save_data.locations[key].actions).forEach(action_key => {
                    if(save_data.locations[key].actions[action_key].is_unlocked) {
                        locations[key].actions[action_key].is_unlocked = true;
                    }

                    if(save_data.locations[key].actions[action_key].is_finished) {
                        locations[key].actions[action_key].is_finished = true;
                    }

                });
            }
			
			
        } else {
            console.warn(`Location "${key}" couldn't be found!`);
            return;
        }
    }); //load for locations their unlocked status and their killcounts

    Object.keys(save_data.activities).forEach(function(activity) {
        if(activities[activity]) {
            activities[activity].is_unlocked = save_data.activities[activity].is_unlocked || false;
        } else if(activity === "plowing the fields") {
            activities["fieldwork"].is_unlocked = save_data.activities[activity].is_unlocked || false;
        } else {
            console.warn(`Activity "${activity}" couldn't be found!`);
        }
    });

    setLootSoldCount(save_data.loot_sold_count || {});

    //load active effects if save is not from before their rework
    if(compare_game_version(save_data["game version"], "v0.4.4") >= 0){
        Object.keys(save_data.active_effects).forEach(function(effect) {
            active_effects[effect] = save_data.active_effects[effect];
        });
    }
    if(save_data.character.hp_to_full == null || save_data.character.hp_to_full >= character.stats.full.max_health) {
        character.stats.full.health = 1;
    } else {
        character.stats.full.health = character.stats.full.max_health - save_data.character.hp_to_full;
    }
    //if missing hp is null (save got corrupted) or its more than max_health, set health to minimum allowed (which is 1)
    //otherwise just do simple substraction
    //then same with stamina below
    if(save_data.character.stamina_to_full == null || save_data.character.stamina_to_full >= character.stats.full.max_stamina) {
        character.stats.full.stamina = 0;
    } else {
        character.stats.full.stamina = character.stats.full.max_stamina - save_data.character.stamina_to_full;
    }

    if(save_data["enemy_killcount"]) {
        Object.keys(save_data["enemy_killcount"]).forEach(enemy_name => {
            enemy_killcount[enemy_name] = save_data["enemy_killcount"][enemy_name];
            create_new_bestiary_entry(enemy_name);
        });
    }
	
	if (save_data["used_elixirs"]) {
    character.stats.flat.elixirs = {};

    for (const stat in save_data["used_elixirs"]) {
        character.stats.flat.elixirs[stat] = save_data["used_elixirs"][stat];
    }

    // Reapply bonus and refresh displays
    character.stats.add_active_effect_bonus();
    update_character_stats();
    update_displayed_stats();
}

    update_character_stats();
    update_displayed_character_inventory();

    update_displayed_health();
    //load current health
    
    update_displayed_effects();
    
    create_displayed_crafting_recipes();
    change_location(save_data["current location"]);

    //set activity if any saved
    if(save_data.current_activity) {
        //search for it in location from save_data
        const activity_id = save_data.current_activity.activity_id;
        if(typeof activity_id !== "undefined" && current_location.activities[activity_id] && activities[current_location.activities[activity_id].activity_name]) {
            
            start_activity(activity_id);
            if(activities[current_location.activities[activity_id].activity_name].type === "JOB") {
                current_activity.working_time = save_data.current_activity.working_time;
                current_activity.earnings = save_data.current_activity.earnings * ((is_from_before_eco_rework == 1)*10 || 1);
                document.getElementById("action_end_earnings").innerHTML = `(earnings: ${format_money(current_activity.earnings)})`;
            } else if(activities[current_location.activities[activity_id].activity_name].type === "GATHERING") {
                current_activity.gathered_materials = save_data.current_activity.gathered_materials || {};
            }

            current_activity.gathering_time = save_data.current_activity.gathering_time;
            
        } else {
            console.warn(`Couldn't find saved activity "${activity_id}"! It might have been removed`);
        }
    }

    if(save_data.is_sleeping) {
        start_sleeping();
    }
    if(save_data.is_reading) {
        start_reading(save_data.is_reading);
    }

    update_displayed_time();
	
	
} //core function for loading

/**
 * called from index.html
 * loads game from file by resetting everything that needs to be reset and then calling main loading method with same parameter
 * @param {String} save_string 
 */
function load_from_file(save_string) {
    try{
        if(is_on_dev()) {
            localStorage.setItem(dev_save_key, atob(save_string));
        } else {
            localStorage.setItem(save_key, atob(save_string));
        }        
        window.location.reload(false);
    } catch (error) {
        console.error("Something went wrong on preparing to load from file!");
        console.error(error);
    }
} //called on loading from file, clears everything

/**
 * loads the game from localStorage
 * it's called when page is refreshed, so there's no need for it to reset anything
 */
function load_from_localstorage() {
	
    try{
        if(is_on_dev()) {
            if(localStorage.getItem(dev_save_key)){
                load(JSON.parse(localStorage.getItem(dev_save_key)));
                log_message("Loaded dev save. If you want to use save from live version, import it through options panel or manually");
            } else {
                load(JSON.parse(localStorage.getItem(save_key)));
                log_message("Dev save was not found. Loaded live version save.");
            }
        } else {
            load(JSON.parse(localStorage.getItem(save_key)));
        }
    } catch(error) {
        console.error("Something went wrong on loading from localStorage!");
        console.error(error);
    }
}

function load_backup() {
    try{
        if(is_on_dev()) {
            if(localStorage.getItem(dev_backup_key)){
                localStorage.setItem(dev_save_key, localStorage.getItem(dev_backup_key));
                window.location.reload(false);
            } else {
                console.log("Can't load backup as there is none yet.");
                log_message("Can't load backup as there is none yet.");
            }
        } else {
            if(localStorage.getItem(backup_key)){
                localStorage.setItem(save_key, localStorage.getItem(backup_key));
                window.location.reload(false);
            } else {
                console.log("Can't load backup as there is none yet.")
                log_message("Can't load backup as there is none yet.");
            }
        }
    } catch(error) {
        console.error("Something went wrong on loading from localStorage!");
        console.error(error);
    }
}

function load_other_release_save() {
    try{
        if(is_on_dev()) {
            if(localStorage.getItem(save_key)){
                localStorage.setItem(dev_save_key, localStorage.getItem(save_key));
                window.location.reload(false);
            } else {
                console.log("There are no saves on the other release.")
                log_message("There are no saves on the other release.");
            }
        } else {
            if(localStorage.getItem(dev_save_key)){
                localStorage.setItem(save_key, localStorage.getItem(dev_save_key));
                window.location.reload(false);
            } else {
                console.log("There are no saves on the other release.");
                log_message("There are no saves on the other release.");
            }
        }
    } catch(error) {
        console.error("Something went wrong on loading from localStorage!");
        console.error(error);
    }
}

//update game time
function update_timer() {
    current_game_time.go_up(is_sleeping ? 6 : 1);
    update_character_stats(); //done every second, mostly because of daynight cycle; gotta optimize it at some point
    update_displayed_time();
}

function update() {
    setTimeout(function()
    {
        end_date = Date.now(); 
        //basically when previous tick ends

        time_variance_accumulator += ((end_date - start_date) - 1000/tickrate);
        //duration of previous tick, minus time it was supposed to take
        //important to keep it between setting end_date and start_date, so they are 2 completely separate values

        start_date = Date.now();
        /*
        basically when current tick starts
        so before this assignment, start_date is when previous tick started
        and end_date is when previous_tick ended
        */

        const prev_day = current_game_time.day;
        update_timer();

        const curr_day = current_game_time.day;
        if(curr_day > prev_day) {
            recoverItemPrices();
            update_displayed_character_inventory();
        }

                if("parent_location" in current_location){ //if it's a combat_zone

            //use consumables if their longest effect ran out
            //remove them from list if there are no more in inventory
            Object.keys(favourite_consumables).forEach(item_id => {
                const inv_key = item_templates[item_id].getInventoryKey();
                if(!character.inventory[inv_key]) {
                    //if out of item, remove it from auto-consume
                    remove_consumable_from_favourites(item_id);
                    return;
                }

                const effects = item_templates[item_id].effects.sort((a,b) => {
                    if(options.auto_use_when_longest_runs_out) {
                        return b.duration-a.duration;
                    } else {
                         return a.duration-b.duration;
                    }
                });

                //if effect not active, use item and return
                if(!active_effects[effects[0].effect]) {
                    use_item(inv_key);
                    //use will call remove item which will call remove consumable from favs, so nothing more to do here
                    return;
                }
            });
        } else { //everything other than combat
            if(is_sleeping) {
                do_sleeping();
                add_xp_to_skill({skill: skills["Sleeping"], xp_to_add: current_location.sleeping?.xp});
            }
            else {
                if(is_resting) {
                    do_resting();
                }
                if(is_reading) {
                    do_reading();
                }
				if(is_rereading) {
                    do_rereading();
                }
            } 

            if(selected_stance !== current_stance) {
                change_stance(selected_stance);
            }

            if(current_activity) { //in activity
			
				if (current_activity.activity_cost) {
				const cost = current_activity.activity_cost;
				const type = cost.type;
				const amount = cost.amount;
				let can_afford = true;
				let effective_cost = amount;
				let use_efficiency = true;

				switch (type) {
					case "money":
						can_afford = character.money >= amount;
						break;
					case "health":
						can_afford = character.stats.full.health >= amount;
						break;
					case "stamina":
						effective_cost = amount / ((use_efficiency * character.stats.full.stamina_efficiency) || 1);
						can_afford = character.stats.full.stamina >= effective_cost;
						break;
					case "mana":
						effective_cost = amount / ((use_efficiency * character.stats.full.mana_efficiency) || 1);
						can_afford = character.stats.full.mana >= effective_cost;
						break;
					default:
						console.warn("Unknown activity cost type:", type);
						can_afford = true; // Failsafe: allow activity if type is unknown
				}

					if (!can_afford) {
					end_activity(); // ends current activity
					// Skip remaining activity handling, but allow regen and rest of tick to continue
				} else {
					// Pay the cost
					switch (type) {
						case "money":
							character.money -= amount;
							update_displayed_money();
							break;
						case "health":
							character.stats.full.health -= amount;
							update_displayed_health();
							break;
						case "stamina":
							character.stats.full.stamina -= effective_cost;
							update_displayed_stamina();
							break;
						case "mana":
							character.stats.full.mana -= effective_cost;
							update_displayed_mana();
							break;
					}
				}
				}
			}
			
			
			if(current_activity) {
                //add xp to all related skills
                if(activities[current_activity.activity_name].type !== "GATHERING"){
                    for(let i = 0; i < activities[current_activity.activity_name].base_skills_names?.length; i++) {
                        add_xp_to_skill({skill: skills[activities[current_activity.activity_name].base_skills_names[i]], xp_to_add: current_activity.skill_xp_per_tick});
                    }
                }
		   
		   if(activities[current_activity.activity_name].type === "TRAINING") {
                    add_xp_to_skill({skill: skills["Breathing"], xp_to_add: 0.5});
                } else {
                    add_xp_to_skill({skill: skills["Breathing"], xp_to_add: 0.1});
                }

                current_activity.gathering_time += 1;
                if(current_activity.gained_resources)
                {
                    if(current_activity.gathering_time >= current_activity.gathering_time_needed) { 
                        const {gathering_time_needed, gained_resources} = current_activity.getActivityEfficiency();

                        current_activity.gathering_time_needed = gathering_time_needed;

                        const items = [];

                        const {resources} = current_activity.gained_resources;
				const base_skill_names = activities[current_activity.activity_name].base_skills_names || [];
				

let rare_loot = [];
if (Math.random() < 0.0001) {
    let rareItemName;
    console.log(base_skill_names);
    switch(base_skill_names[0]) {
        case "Woodcutting":
            rareItemName = "Golden Apple";
            break;
        case "Mining":
            rareItemName = "Diamond";
            break;
		case "Fishing":
            rareItemName = "Succulent Shark";
            break;
		case "Herbalism":
            rareItemName = "Miracle Weed";
            break;
        default: 
            
            break;
    } 
    
    // Only push to rare_loot if we have a valid item name
    if (rareItemName) {
        rare_loot.push({ "item": getItem(item_templates[rareItemName]), "count": 1 });
    }
}

if (rare_loot.length > 0) {
    log_rare_loot(rare_loot);
    add_to_character_inventory(rare_loot);
}



for (let i = 0; i < resources.length; i++) {
    const resource = resources[i];

    // Extract per-resource requirement if present
    let required_skill_level = resource.skill_required;

    // If not present, fall back to global skill_required lower bound
    if (required_skill_level === undefined) {
        const global_req = current_activity.gained_resources.skill_required;
        required_skill_level = Array.isArray(global_req) ? global_req[0] : global_req;
    }

    // Check if at least one base skill meets the requirement
    const meetsRequirement = base_skill_names.some(skill_name => {
        const skill = skills[skill_name];
        return skill && skill.current_level >= required_skill_level;
    });

    if (!meetsRequirement) continue;
	
				const bonus_skill = activities[current_activity.activity_name]?.bonus_skill;
		const chance = Array.isArray(resource.chance) ? resource.chance[1] : resource.chance;

		if (Math.random() > (1 - chance)) {
			const countRange = Array.isArray(resource.ammount) ? resource.ammount[1] : [1, 1];
			const baseCount = Math.floor(Math.random() * (countRange[1] - countRange[0] + 1)) + countRange[0];

			// Skill coefficient (0 to 1)
			const skillCoefficient = bonus_skill ? (skills[bonus_skill]?.get_coefficient("flat") || 0) : 0;
	
			// Apply bonus per unit
			let bonusCount = 0;
			for (let j = 0; j < baseCount; j++) {
				if (Math.random() < (skillCoefficient-1)) bonusCount++;
			}

			const totalCount = baseCount + bonusCount;

			items.push({ item_key: resource.name, item: item_templates[resource.name], count: totalCount });
			gathered_materials[resource.name] = (gathered_materials[resource.name] || 0) + totalCount;
	
    }
}

                        if(items.length > 0) {
                            log_loot(items, false);
							
							 for(let i = 0; i < items.length; i++) {
                                current_activity.gathered_materials[items[i].item_key] = (current_activity.gathered_materials[items[i].item_key] + items[i].count || items[i].count);
								
                            }

                            add_to_character_inventory(items);
                        }

                        let leveled = false;
                        if(activities[current_activity.activity_name].type === "GATHERING"){
                            for(let i = 0; i < activities[current_activity.activity_name].base_skills_names?.length; i++) {
                                leveled = add_xp_to_skill({skill: skills[activities[current_activity.activity_name].base_skills_names[i]], xp_to_add: current_activity.skill_xp_per_tick}) || leveled;
                            }
                          
							if(activities[current_activity.activity_name].bonus_skill && skills[activities[current_activity.activity_name].bonus_skill].current_level > 0){
								
							add_xp_to_skill({skill: skills[activities[current_activity.activity_name].bonus_skill], xp_to_add: current_activity.skill_xp_per_tick})
							}
                            //if(leveled) {
                                update_gathering_tooltip(current_activity);
                            //}
                        }

                        current_activity.gathering_time = 0;
                    }
                }

                //if job: payment
                if(activities[current_activity.activity_name].type === "JOB") {
                    current_activity.working_time += 1;

                    if(current_activity.working_time % current_activity.working_period == 0) { 
                        //finished working period, add money
                        current_activity.earnings += current_activity.get_payment();
                    }
                    update_displayed_ongoing_activity(current_activity, true);
                    
                    if(!can_work(current_activity)) {
                        end_activity();
                    }
                } else {
                    update_displayed_ongoing_activity(current_activity, false);
                }

                //if gathering: add drops to inventory

            } else {
                const divs = document.getElementsByClassName("activity_div");
                for(let i = 0; i < divs.length; i++) {
                    const activity = current_location.activities[divs[i].getAttribute("data-activity")];

                    if(activities[activity.activity_name].type === "JOB") {
                        if(can_work(activity)) {
                            divs[i].classList.remove("activity_unavailable");
                            divs[i].classList.add("start_activity");
                        } else {
                            divs[i].classList.remove("start_activity");
                            divs[i].classList.add("activity_unavailable");
                        }
                        
                    }
                }
            }

            const sounds = current_location.getBackgroundNoises();
            if(sounds.length > 0){
                if(Math.random() < 1/600) {
                    log_message(`"${sounds[Math.floor(Math.random()*sounds.length)]}"`, "background");
                }
            }
        }

        Object.keys(active_effects).forEach(key => {
            active_effects[key].duration--;
            if(active_effects[key].duration <= 0) {
                delete active_effects[key];
                character.stats.add_active_effect_bonus();
                update_character_stats();
				update_displayed_stats();
            }
        });
        update_displayed_effect_durations();
        update_displayed_effects();




        //health regen
        if(character.stats.full.health_regeneration_flat) {
            character.stats.full.health += character.stats.full.health_regeneration_flat;
        }
        if(character.stats.full.health_regeneration_percent) {
            character.stats.full.health += character.stats.full.max_health * character.stats.full.health_regeneration_percent/100;
        }
		
      //health loss
        if(character.stats.full.health_loss_flat) {
            character.stats.full.health += character.stats.full.health_loss_flat;
        }
        if(character.stats.full.health_loss_percent) {
            character.stats.full.health += character.stats.full.max_health * character.stats.full.health_loss_percent/100;
        }

       if(character.stats.full.health <= 0) {
            kill_player({is_combat: "parent_location" in current_location});
        }
		
		
        //stamina regen
        if(character.stats.full.stamina_regeneration_flat) {
            character.stats.full.stamina += character.stats.full.stamina_regeneration_flat;
        }
        if(character.stats.full.stamina_regeneration_percent) {
            character.stats.full.stamina += character.stats.full.max_stamina * character.stats.full.stamina_regeneration_percent/100;
        }
        //mana regen
        if(character.stats.full.mana_regeneration_flat) {
            character.stats.full.mana += character.stats.full.mana_regeneration_flat
        }
        if(character.stats.full.mana_regeneration_percent) {
            character.stats.full.mana += character.stats.full.max_mana * character.stats.full.mana_regeneration_percent/100;
        }

        if(character.stats.full.health > character.stats.full.max_health) {
            character.stats.full.health = character.stats.full.max_health
        }

        if(character.stats.full.stamina > character.stats.full.max_stamina) {
            character.stats.full.stamina = character.stats.full.max_stamina
        }

        if(character.stats.full.mana > character.stats.full.max_mana) {
            character.stats.full.mana = character.stats.full.max_mana
        }

       if(character.stats.full.health_regeneration_flat || character.stats.full.health_regeneration_percent 
            || character.stats.full.health_loss_flat || character.stats.full.health_loss_percent
        ) {
            update_displayed_health();
        }
        if(character.stats.full.stamina_regeneration_flat || character.stats.full.stamina_regeneration_percent) {
            update_displayed_stamina();
        }
        if(character.stats.full.mana_regeneration_flat || character.stats.full.mana_regeneration_percent) {
            update_displayed_mana();
        }

        
        save_counter += 1;
        if(save_counter >= save_period*tickrate) {
            save_counter = 0;
            if(is_on_dev()) {
                save_to_localStorage({key: dev_save_key});
            } else {
                save_to_localStorage({key: save_key});
            }
            console.log("Auto-saved the game!");
        } //save in regular intervals, irl time independent from tickrate

        backup_counter += 1;
        if(backup_counter >= backup_period*tickrate) {
            backup_counter = 0;
            let saved_at;
            if(is_on_dev()) {
                saved_at = save_to_localStorage({key: dev_backup_key});
            } else {
                saved_at = save_to_localStorage({key: backup_key});
            }

            if(saved_at) {
                update_backup_load_button(saved_at);
            }
            console.log("Created an automatic backup!");
        }

        if(!is_sleeping && current_location && current_location.light_level === "normal" && (current_game_time.hour >= 20 || current_game_time.hour <= 4)) 
        {
            add_xp_to_skill({skill: skills["Night vision"], xp_to_add: 1});
        }

        //add xp to proper skills based on location types
        if(current_location) {
            const skills = current_location.gained_skills;
            let leveled = false;
            for(let i = 0; i < skills?.length; i++) {
                leveled = add_xp_to_skill({skill: current_location.gained_skills[i].skill, xp_to_add: current_location.gained_skills[i].xp}) || leveled;
            }
            if(leveled){
                update_displayed_location_types(current_location);
            }
        }
		
		

		if(current_location.ambient_damage > 0) {
			ambient_damage_counter++;
    
		if(ambient_damage_counter >= 10) {
        execute_ambient_damage(current_location.ambient_damage, 
                             current_location.ambient_damage_type, 
                             current_location.ambient_damage_related_skill);
        update_displayed_health();
        ambient_damage_counter = 0;  // Reset counter
    }
}
		// Tick down all magic cooldowns
		Object.keys(magic_cooldowns).forEach(magicId => {
		if (magic_cooldowns[magicId] > 0) {
        magic_cooldowns[magicId]--;
        if (magic_cooldowns[magicId] === 0) {
            delete magic_cooldowns[magicId];
        }
    }
});
function handle_auto_cast_magic() {
    const low_mana_auto_casts = [];

    Object.keys(magics).forEach(magicId => {
        const magic = magics[magicId];
        if (!magic.is_unlocked) return;

        const checkbox = document.getElementById(`auto_magic_${magicId}`);
        if (checkbox && checkbox.checked && !magic_cooldowns[magicId]) {
            const result = cast_magic(magicId, true); // returns "low_mana" on low mana auto-cast
            if (result === "low_mana") {
                low_mana_auto_casts.push(magic.names[0]);
            }
        }
    });

    const existingMsg = document.getElementById("autocast_failure_msg");
    if (low_mana_auto_casts.length > 0) {
        const content = `Not enough mana to auto-cast: ${low_mana_auto_casts.join(", ")}`;
        if (existingMsg) {
            existingMsg.innerHTML = content + "<div class='message_border'> </div>";
        } else {
            log_message(content, "autocast_failure", true); // true = priority
        }
    } else if (existingMsg) {
        existingMsg.remove(); // Remove if nothing is failing
    }
}
update_displayed_magic_list();

        //limiting maximum adjustment, to avoid any absurd results;
        if(time_variance_accumulator <= 100/tickrate && time_variance_accumulator >= -100/tickrate) {
            time_adjustment = time_variance_accumulator;
        }
        else {
            if(time_variance_accumulator > 100/tickrate) {
                time_adjustment = 100/tickrate;
            }
            else {
                if(time_variance_accumulator < -100/tickrate) {
                    time_adjustment = -100/tickrate;
                }
            }
        }

        total_playtime += 1/tickrate;
		handle_auto_cast_magic();
        update();
    }, 1000/tickrate - time_adjustment);
    //uses time_adjustment based on time_variance_accumulator for more precise overall stabilization
    //(instead of only stabilizing relative to previous tick, it stabilizes relative to sum of deviations)
    //probably completely unnecessary lol, but hey, it sounds cool
}

function add_allies_to_party(ally_id, suppress_messages = false) {
    const ally = allies[ally_id];

    if (!ally) {
        if (!suppress_messages) {
            log_message(`Ally with ID ${ally_id} does not exist.`);
        }
        return;
    }

    if (current_party.includes(ally.ally_id)) {
        if (!suppress_messages) {
            log_message(`${ally.name} is already in the party. How did you manage that?`);
        }
        return;
    }

    if (current_party.length >= 4) {
        if (!suppress_messages) {
            log_message(`Party is full. Cannot add ${ally.name}.`);
        }
        return;
    }

    current_party.push(ally.ally_id);
    if (!suppress_messages) {
        log_message(`${ally.name} has joined the party.`);
    }
	update_party_list();
}


function remove_allies_from_party(ally_id) {
    const index = current_party.findIndex(a => a.id === ally_id.ally_id);

    if (index === -1) {
        log_message(`Nobody named ${ally_id} is in your party.`);
        return;
    }

    const removed = current_party.splice(index, 1)[0];
    log_message(`The ${capitalize_first_letter(removed)} has been removed from the party.`);
	update_party_list();
}

function capitalize_first_letter(some_string) {
    return some_string.charAt(0).toUpperCase() + some_string.slice(1);
}

function run() {
    if(typeof current_location === "undefined") {
        change_location("Burial Chamber");
    } 
    
    update_displayed_health();
	
        
    start_date = Date.now();
    update();   
}

window.equip_item = character_equip_item;
window.unequip_item = character_unequip_item;

window.change_location = change_location;
window.reload_normal_location = reload_normal_location;

window.start_dialogue = start_dialogue;
window.end_dialogue = end_dialogue;
window.start_textline = start_textline;

window.update_displayed_location_choices = update_displayed_location_choices;

window.start_activity = start_activity;
window.end_activity = end_activity;

window.start_location_action = start_location_action;
window.end_location_action = end_location_action;

window.start_sleeping = start_sleeping;
window.end_sleeping = end_sleeping;

window.start_reading = start_reading;
window.end_reading = end_reading;
window.end_rereading = end_rereading;

window.start_trade = start_trade;
window.exit_trade = exit_trade;
window.add_to_buying_list = add_to_buying_list;
window.remove_from_buying_list = remove_from_buying_list;
window.add_to_selling_list = add_to_selling_list;
window.remove_from_selling_list = remove_from_selling_list;
window.cancel_trade = cancel_trade;
window.accept_trade = accept_trade;
window.is_in_trade = is_in_trade;

window.format_money = format_money;
window.get_character_money = character.get_character_money;

window.use_item = use_item;
window.change_consumable_favourite_status = change_consumable_favourite_status;

window.do_enemy_combat_action = do_enemy_combat_action;

window.sort_displayed_inventory = sort_displayed_inventory;
window.update_displayed_character_inventory = update_displayed_character_inventory;
window.update_displayed_trader_inventory = update_displayed_trader_inventory;

window.sort_displayed_skills = sort_displayed_skills;

window.change_stance = change_stance;
window.fav_stance = fav_stance;

window.cast_magic = cast_magic;

window.openCraftingWindow = open_crafting_window;
window.closeCraftingWindow = close_crafting_window;
window.switchCraftingRecipesPage = switch_crafting_recipes_page;
window.switchCraftingRecipesSubpage = switch_crafting_recipes_subpage;
window.useRecipe = use_recipe;
window.updateDisplayedComponentChoice = update_displayed_component_choice;
window.updateDisplayedMaterialChoice = update_displayed_material_choice;
window.updateRecipeTooltip = update_recipe_tooltip;

window.option_uniform_textsize = option_uniform_textsize;
window.option_bed_return = option_bed_return;
window.option_combat_autoswitch = option_combat_autoswitch;
window.option_remember_filters = option_remember_filters;
window.option_log_gathering_result = option_log_gathering_result;

window.getDate = get_date;

window.saveProgress = save_progress;
window.save_to_file = save_to_file;
window.load_progress = load_from_file;
window.loadBackup = load_backup;
window.importOtherReleaseSave = load_other_release_save;
window.get_game_version = get_game_version;

if(save_key in localStorage || (is_on_dev() && dev_save_key in localStorage)) {
    load_from_localstorage();
    update_character_stats();
    update_displayed_xp_bonuses();
}
else {
    add_to_character_inventory([{item: getItem({...item_templates["Cheap iron dagger"], quality: 40})}, 
                                {item: getItem({...item_templates["Cheap leather pants"], quality: 40})},
                                {item: getItem(item_templates["Stale bread"]), count: 5},
                                //{item: getItem(item_templates["Rat fang"]), count: 1000},
                            ]);

    equip_item_from_inventory({item_name: "Cheap iron sword", item_id: 0});
    equip_item_from_inventory({item_name: "Cheap leather pants", item_id: 0});
    add_xp_to_character(0);
    character.money = 102;
    update_displayed_money();
    update_character_stats();

    update_displayed_stance_list();
    change_stance("normal");
    create_displayed_crafting_recipes();
    change_location("Burial Chamber");
	log_message("You force yourself awake and immediately regret it. You are sure that this world has many unpleasant things in store for you. You will need to get much stronger to overcome them.");
} //checks if there's an existing save file, otherwise just sets up some initial equipment

document.getElementById("loading_screen").style.visibility = "hidden";


function add_stuff_for_testing() {
    add_to_character_inventory([
        {item: getItem({...item_templates["Iron spear"], quality: 1}), count: 100},
        {item: getItem({...item_templates["Iron spear"], quality: 2}), count: 100},
        {item: getItem({...item_templates["Iron spear"], quality: 1}), count: 1},
    ]);
}

function add_all_stuff_to_inventory(){
    Object.keys(item_templates).forEach(item => {
        add_to_character_inventory([
            {item: getItem({...item_templates[item]}), count: 5},
        ]);
    })
}

//add_to_character_inventory([{item: getItem(item_templates["ABC for kids"]), count: 10}]);
//add_stuff_for_testing();
//add_all_stuff_to_inventory();

update_displayed_equipment();
sort_displayed_inventory({sort_by: "name", target: "character"});

run();

//Verify_Game_Objects();
window.Verify_Game_Objects = Verify_Game_Objects;

if(is_on_dev()) {
    log_message("It looks like you are playing on the dev release. It is recommended to keep the developer console open (in Chrome/Firefox/Edge it's at F12 => 'Console' tab) in case of any errors/warnings appearing in there.", "notification");

    if(localStorage[dev_backup_key]) {
        update_backup_load_button(JSON.parse(localStorage[dev_backup_key]).saved_at);
    } else {
        update_backup_load_button();
    }

    if(localStorage[save_key]) {
        update_other_save_load_button(JSON.parse(localStorage[save_key]).saved_at || "", true);
    } else {
        update_other_save_load_button(null, true);
    }
} else {
    if(localStorage[backup_key]) {
        update_backup_load_button(JSON.parse(localStorage[backup_key]).saved_at);
    } else {
        update_backup_load_button();
    }

    if(localStorage[dev_save_key]) {
        update_other_save_load_button(JSON.parse(localStorage[dev_save_key]).saved_at || "");
    } else {
        update_other_save_load_button();
    }
}




export { current_enemies, can_work, 
        current_location, active_effects, 
        enough_time_for_earnings, add_xp_to_skill, 
        get_current_book, 
        last_location_with_bed, 
        last_combat_location, 
        current_stance, selected_stance,
		cast_magic,
        faved_stances, options,
        global_flags,
		magic_cooldowns,
		favourite_consumables,
		remove_consumable_from_favourites,
        character_equip_item,
		unlock_magic,
		unlock_combat_stance,
		current_party,
		global_battle_state,
		end_actions,
		active_quests,
		finished_quests,
		paired_skill_sets,
		getGroupLeaderName
 };