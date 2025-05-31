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
				task_rewards: {type: "hero_xp", value: 100},
				task_rewards: {type: "skill_xp", skill: "Lockpicking", value: 100},
				task_rewards: {type: "item", item_name: "Iron spear", count: 2}, count is optional
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