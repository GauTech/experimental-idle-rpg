"use strict";


const quests = {};


class QuestTask {
    constructor({
        task_description = "", //optional
        task_condition, //an array of conditions for task to be completed; completing any of them finishes the task
        task_progress,
		task_name,
        task_rewards = {}, //generally skipped but could sometimes have something?
        is_hidden = false, //keep it false most of the time, but could be used as a fake way of making quests with no visible requirement for progress
        is_finished = false,
    })
    {
        this.task_name = task_name;
		this.task_description = task_description;
        this.task_condition = task_condition;
        this.task_progress = task_progress;
        this.task_rewards = task_rewards;
						/*
				task_rewards: {type: "hero_xp", value: 100},
				task_rewards: {type: "skill_xp", skill: "Lockpicking", value: 100},
				task_rewards: {type: "item", item_name: "Iron spear", count: 2}, count is optional
				task_rewards: {type: "dummy_x"}, displays as normal but skipped by rewards handler. used if reward is actioned by something else e.g. dialogue.
 				*/
        this.is_hidden = is_hidden;
        this.is_finished = is_finished;
    }
}

class Quest {
    constructor({
                quest_name, //for display, can be skipped if getQuestName covers all possibilites
                quest_id, 
                quest_description, // -||-
                questline, //questline for grouping or something, skippable
                quest_tasks = [], //an array of tasks that need to be completed one by one
                quest_condition, //an array of conditions for the quest to be completed; completing any of them completes the quest 
				//valid types [{enter: "Sanctuary"}], [{clear: "Infested Field"}], [{requires_item: "Bread", count: 5}],
                quest_progress, //both this and quest_condition can be skipped if there's quest_tasks, or can stay to allow completing the quest without fulfilling them all
                quest_rewards, //may include a new quest to automatically start
				/*
				quest_rewards: {type: "hero_xp", value: 100},
				quest_rewards: {type: "skill_xp", skill: "Lockpicking", value: 100},
				quest_rewards: {type: "item", item_name: "Iron spear", count: 2}, count is optional
				quest_rewards: {type: "dummy_x"}, displays as normal but skipped by rewards handler. used if reward is actioned by something else e.g. dialogue.
				*/
                is_hidden = false, //hidden quests are not visible and are meant to function as additional unlock mechanism; name and description are skipped
                is_finished = false,
                getQuestName = ()=>{return this.quest_name;},
                getQuestDescription = ()=>{return this.quest_description;},
    }) {
        this.quest_name = quest_name;
        this.quest_id = quest_id || quest_name;
        this.questline = questline;
        this.quest_tasks = quest_tasks;
        this.quest_description = quest_description;
        this.quest_rewards = quest_rewards || {};
        this.is_hidden = is_hidden;
        this.is_finished = is_finished;
        this.quest_condition = quest_condition;
        this.quest_progress = quest_progress;
        this.getQuestName = getQuestName;
    }
    qetCompletedTaskCount(){
        if(this.quest_tasks.length == 0) {
            return 0;
        } else {
            return this.quest_tasks.filter(task => task.is_finished).length;
        }
    }
}





quests["Lost memory"] = new Quest({
    quest_name: "???",
	quest_id: "Lost memory",
    qetQuestName: ()=>{
        const completed_tasks = this.getCompletedtaskCount();
        if(completed_tasks == 0) {
            return "???";
        } else {
            return "The Search";
        }
    },
    getQuestDescription: ()=>{
        const completed_tasks = this.getCompletedtaskCount();
        if(completed_tasks == 0) {
            return "You woke up in some village and you have no idea how you got here or who you are. Just what could have happened?";
        } else if(completed_tasks == 1) {
            return "You lost your memories after being attacked by unknown assailants and were rescued by local villagers.";
        } else {
            return "You lost your memories after being attacked by unknown assailants and were rescued by local villagers. You need to find out who, why, and if possible, how to recover them.";
        }
    },
    questline: "Lost memory",
    quest_tasks: [
        new QuestTask({task_description: "Find out what happened",
			task_name: "Lost memory1",
		      task_condition: {
                any: {
                    enter: "Infested field",
                }
            },
			task_rewards: {type: "item", item_name: "Leather vest"},
			}),
        new QuestTask({
            task_description: "Help with the wolf rat infestation",
			task_name: "Lost memory2",
            task_condition: {
                any: {
                    clear: "Infested field",
                }
            },
			task_rewards: {type: "hero_xp", value: 100}, 
        }),
    ]
});

quests["Wanderer's Rest"] = new Quest({
    quest_name: "Wanderer's Rest",
	quest_id: "Wanderer's Rest",
	quest_description: "If there really is a settlement nearby, then it could be a good source of equipment and supplies. I should investigate.",
    /*quest_tasks: [
        new QuestTask({
            task_description: "Locate the Sanctuary",
            task_condition: {
                any: {
                    enter: "Sanctuary",
                }
            },
        }),
    ],*/
	quest_rewards: {type: "hero_xp", value: 50},
	quest_condition: [{enter: "Sanctuary"}],
	//quest_condition: 
});


quests["The Super Pickaxe"] = new Quest({
    quest_name: "The Super Pickaxe",
	quest_id: "The Super Pickaxe",
	quest_description: "The confused madman who gave me the old pickaxe seemed to want ores. With my honed skills perhaps I can satisfy his demands.",

	quest_rewards: {type: "item", item_name: "Super pickaxe"},
	quest_condition: [{requires_item: "Blacksteel Ore", count: 3000}], 
});

quests["The Super Axe"] = new Quest({
    quest_name: "The Super Axe",
	quest_id: "The Super Axe",
	quest_description: "The confused madman who gave me the old pickaxe seemed to want ores. With my honed skills perhaps I can satisfy his demands.",

	quest_rewards: {type: "item", item_name: "Super axe",},
	quest_condition: [{requires_item: "Piece of ash wood", count: 3000}],
});

quests["The Super Rod"] = new Quest({
    quest_name: "The Super Rod",
	quest_id: "The Super Rod",
	quest_description: "The fisherman who gave me the old rod might have a better rod to offer if I demonstrate my skills.",

	quest_rewards: {type: "item", item_name: "Super rod",},
	quest_condition: [{requires_item: "Cunning Carp", count: 1000}],
});

quests["Crazy for Craniums"] = new Quest({
    quest_name: "Crazy for Craniums",
	quest_id: "Crazy for Craniums",
	quest_description: "The necromancer in the Grave of Heroes has a pressing need for Elite Skulls. Whatever unsavory designs he has for them, he's promised to reward me if I help him out.",

	quest_rewards: {type: "dummy_magic", value: "Raise Dead",},
	quest_condition: [{requires_item: "Elite Skull", count: 5}],
});

quests["Sky's the Limit"] = new Quest({
    quest_name: "Sky's the Limit",
	quest_id: "Sky's the Limit",
	quest_description: "The only way up the tower is climbing the exterior. My adventurer’s intuition tells me I need a Climbing skill of at least 9 to make it.",

	quest_rewards: {type: "dummy_location", value: "Upper Tower",},
	quest_condition: [{clear: "Tower climbing"}],
});

quests["Stone Door to Somewhere"] = new Quest({
    quest_name: "Stone Door to Somewhere",
	quest_id: "Stone Door to Somewhere",
	quest_description: "The Catacombs house a great stone door leading who knows where. My adventurer’s intuition tells me I need a Strength of at least 25 to open it.",

	quest_rewards: {type: "dummy_location", value: "Cavern",},
	quest_condition: [{clear: "Open the stone door"}],
});

quests["Starting Out - Part1"] = new Quest({
    quest_name: "Starting Out - Part1",
	quest_id: "Starting Out - Part1",
	quest_description: "The chatty lady has promised me some starter gear if I help out around town.",

	quest_rewards: {type: "dummy_item", item_name: "Cheap leather vest",},
	quest_condition: [{skill: "Farming", count: 2}],
});

quests["Starting Out - Part2"] = new Quest({
    quest_name: "Starting Out - Part2",
	quest_id: "Starting Out - Part2",
	quest_description: "The chatty lady has promised me some starter gear if I help out around town.",

	quest_rewards: {type: "dummy_item", item_name: "Cheap leather shoes",},
	quest_condition: [{skill: "Animal handling", count: 2}],
});

/*
quests["Infinite rat saga"] = new Quest({
    quest_name: "???",
    id: "Infinite rat saga",
    quest_description: "",
    quest_tasks: [
        new QuestTask({}),
        
    ]
});
*/

export {quests};