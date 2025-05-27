"use strict";

const dialogues = {};

class Dialogue {
    constructor({ name, 
                  starting_text = `Talk to the ${name}`, 
                  ending_text = `Go back`, 
                  is_unlocked = true, 
                  is_finished = false, 
                  textlines = {}, 
				  requires_items,
				  required_flags,
                  location_name
    }) 
    {
        this.name = name; //displayed name, e.g. "Village elder"
        this.starting_text = starting_text;
        this.ending_text = ending_text; //text shown on option to finish talking
        this.is_unlocked = is_unlocked;
        this.is_finished = is_finished; //separate bool to remove dialogue option if it's finished
        this.textlines = textlines; //all the lines in dialogue
		this.requires_items  = requires_items;

        this.location_name = location_name; //this is purely informative and wrong value shouldn't cause any actual issues
		
		this.required_flags = required_flags;
    }
}

class Textline {
    constructor({name,
                 text,
                 getText,
                 is_unlocked = true,
                 is_finished = false,
                 unlocks = {textlines: [],
                            locations: [],
                            dialogues: [],
                            traders: [],
                            stances: [],
                            flags: [],
                            items: [],
							allies: [],
							expels: [],
                            },
                locks_lines = {},
				requires_items,
                otherUnlocks,
                required_flags,
            }) 
    {
        this.name = name; // displayed option to click, don't make it too long
        this.text = text; // what's shown after clicking
        this.getText = getText || function(){return this.text;};
        this.otherUnlocks = otherUnlocks || function(){return;};
        this.is_unlocked = is_unlocked;
        this.is_finished = is_finished;
		this.requires_items = requires_items;
        this.unlocks = unlocks || {};
        
        this.unlocks.textlines = unlocks.textlines || [];
        this.unlocks.locations = unlocks.locations || [];
        this.unlocks.dialogues = unlocks.dialogues || [];
        this.unlocks.traders = unlocks.traders || [];
        this.unlocks.stances = unlocks.stances || [];
		this.unlocks.magic = unlocks.magic || [];
        this.unlocks.flags = unlocks.flags || [];
		this.unlocks.allies = unlocks.allies || [];
		this.unlocks.expels = unlocks.expels || [];
        this.unlocks.items = unlocks.items || []; //not so much unlocks as simply items that player will receive
		
		
			/*	Can handles just the item name, or name+ count or name+quality.e.g.
		
					"Old pickaxe",
					{ name: "Turtle Soup", count: 50 },
					{ name: "Cheap iron dagger", quality: 40 },
			*/

        
        this.required_flags = required_flags;

        this.locks_lines = locks_lines;
        //related text lines that get locked; might be itself, might be some previous line 
        //e.g. line finishing quest would also lock line like "remind me what I was supposed to do"
        //should be alright if it's limited only to lines in same Dialogue
        //just make sure there won't be Dialogues with ALL lines unavailable
    }
}

(function(){
    dialogues["village elder"] = new Dialogue({
        name: "village elder",
        textlines: {
            "hello": new Textline({
                name: "Hello?",
                text: "Hello. Glad to see you got better",
                unlocks: {
                    textlines: [{dialogue: "village elder", lines: ["what happened", "where am i", "dont remember", "about"]}],
                },
                locks_lines: ["hello"],
            }),
            "what happened": new Textline({
                name: "My head hurts.. What happened?",
                text: `Some of our people found you unconscious in the forest, wounded and with nothing but pants and an old sword, so they brought you to our village. `
                + `It would seem you were on your way to a nearby town when someone attacked you and hit you really hard in the head.`,
                is_unlocked: false,
                locks_lines: ["what happened", "where am i", "dont remember"],
                unlocks: {
                    textlines: [{dialogue: "village elder", lines: ["ask to leave 1"]}],
                },
            }),
            "where am i": new Textline({
                name: "Where am I?",
                text: `Some of our people found you unconscious in the forest, wounded and with nothing but pants and an old sword, so they brought you to our village. `
                + `It would seem you were on your way to a nearby town when someone attacked you and hit you really hard in the head.`,
                is_unlocked: false,
                locks_lines: ["what happened", "where am i", "dont remember"],
                unlocks: {
                    textlines: [{dialogue: "village elder", lines: ["ask to leave 1"]}],
                },
            }),
            "dont remember": new Textline({
                name: "I don't remember how I got here, what happened?",
                text: `Some of our people found you unconscious in the forest, wounded and with nothing but pants and an old sword, so they brought you to our village. `
                + `It would seem you were on your way to a nearby town when someone attacked you and hit you really hard in the head.`,
                is_unlocked: false,
                locks_lines: ["what happened", "where am i", "dont remember"],
                unlocks: {
                    textlines: [{dialogue: "village elder", lines: ["ask to leave 1"]}],
                },
            }),
            "about": new Textline({
                name: "Who are you?",
                text: "I'm the unofficial leader of this village. If you have any questions, come to me",
                is_unlocked: false,
                locks_lines: ["about"]
            }),
            "ask to leave 1": new Textline({
                name: "Great... Thank you for help, but I think I should go there then. Maybe it will help me remember more.",
                text: "Nearby lands are dangerous and you are still too weak to leave. Do you plan on getting ambushed again?",
                is_unlocked: false,
                unlocks: {
                    textlines: [{dialogue: "village elder", lines: ["need to"]}],
                },
                locks_lines: ["ask to leave 1"],
            }),
            "need to": new Textline({
                name: "But I want to leave",
                text: `You first need to recover, to get some rest and maybe also training, as you seem rather frail... Well, you know what? Killing a few wolf rats could be a good exercise. `
                        +`You could help us clear some field of them, how about that?`,
                is_unlocked: false,
                unlocks: {
                    textlines: [{dialogue: "village elder", lines: ["rats", "ask to leave 2", "equipment"]}],
                    locations: ["Infested field"],
                    activities: [{location:"Village", activity:"weightlifting"}, {location:"Village",activity:"running"}],
                },
                locks_lines: ["need to"],
            }),
            "equipment": new Textline({
                name: "Is there any way I could get a weapon and proper clothes?",
                text: `We don't have anything to spare, but you can talk with our trader. He should be somewhere nearby. `
                        +`If you need money, try selling him some rat remains. Fangs, tails or pelts, he will buy them all. I have no idea what he does with this stuff...`,
                is_unlocked: false,
                locks_lines: ["equipment"],
                unlocks: {
                    textlines: [{dialogue: "village elder", lines: ["money"]}],
                    traders: ["village trader"]
                }
            }),
            "money": new Textline({
                name: "Are there other ways to make money?",
                text: "You could help us with some fieldwork. I'm afraid it won't pay too well.",
                is_unlocked: false,
                locks_lines: ["money"],
                unlocks: {
                    activities: [{location: "Village", activity: "fieldwork"}],
                }
            }),
            "ask to leave 2": new Textline({
                name: "Can I leave the village?",
                text: "We talked about this, you are still too weak",
                is_unlocked: false,
            }),
            "rats": new Textline({
                name: "Are wolf rats a big issue?",
                text: `Oh yes, quite a big one. Not literally, no, though they are much larger than normal rats... `
                        +`They are a nasty vermin that's really hard to get rid of. And with their numbers they can be seriously life-threatening. `
                        +`Only in a group though, single wolf rat is not much of a threat`,
                is_unlocked: false,
            }),
            "cleared field": new Textline({ //will be unlocked on clearing infested field combat_zone
                name: "I cleared the field, just as you asked me to",
                text: `You did? That's good. How about a stronger target? Nearby cave is just full of this vermin. `
                        +`Before that, maybe get some sleep? Some folks prepared that shack over there for you. It's clean, it's dry, and it will give you some privacy. `
                        +`Oh, and before I forget, our old craftsman wanted to talk to you.`,
                is_unlocked: false,
                unlocks: {
                    locations: ["Nearby cave", "Infested field", "Shack"],
                    textlines: [{dialogue: "village elder", lines: ["ask to leave 3"]}],
                    dialogues: ["old craftsman"],
                },
                locks_lines: ["ask to leave 2", "cleared field"],
            }),
            "ask to leave 3": new Textline({
                name: "Can I leave the village?",
                text: "You still need to get stronger.",
                unlocks: {
                    locations: ["Nearby cave", "Infested field"],
                    dialogues: ["old craftsman"],
                },
                is_unlocked: false,
            }),
            "cleared cave": new Textline({
                name: "I cleared the cave. Most of it, at least",
                text: `Then I can't call you "too weak" anymore, can I? You are free to leave whenever you want, but still, be careful. You might also want to ask the guard for some tips about the outside. He used to be an adventurer.`,
                is_unlocked: false,
                unlocks: {
                    textlines: [{dialogue: "village elder", lines: ["ask to leave 4"]}],
                    locations: ["Forest road", "Infested field", "Nearby cave"],
                    dialogues: ["village guard"],
                },
                locks_lines: ["ask to leave 3", "rats", "cleared cave"],
            }),
            "ask to leave 4": new Textline({
                name: "Can I leave the village?",
                text: "You are strong enough, you can leave and come whenever you want.",
                is_unlocked: false,
                unlocks: {
                    locations: ["Forest road", "Infested field", "Nearby cave"],
                    dialogues: ["village guard", "old craftsman"],
                },
            }),
            "new tunnel": new Textline({
                name: "I found an even deeper tunnel in the cave",
                text: "The what?... I have a bad feeling about this, you better avoid it until you get better equipment. Don't forget to bring a good shield too.",
                is_unlocked: false,
                locks_lines: ["new tunnel"],
            }),
        }
    });

    dialogues["old craftsman"] = new Dialogue({
        name: "old craftsman",
        is_unlocked: false,
        textlines: {
            "hello": new Textline({
                name: "Hello, I heard you wanted to talk to me?",
                text: "Ahh, good to see you traveler. I just thought of a little something that could be of help for someone like you. See, young people this days "+
                "don't care about the good old art of crafting and prefer to buy everything from the store, but I have a feeling that you just might be different. "+
                "Would you like a quick lesson?",
                unlocks: {
                    textlines: [{dialogue: "old craftsman", lines: ["learn", "leave"]}],
                },
                locks_lines: ["hello"],
            }),
            "learn": new Textline({
                name: "Sure, I'm in no hurry.",
                text: "Ahh, that's great. Well then... \n*[Old man spends some time explaining all the important basics of crafting and providing you with tips]*\n"+
                "Ahh, and before I forget, here, take these. They will be helpful for gathering necessary materials.",
                unlocks: {
                    textlines: [{dialogue: "old craftsman", lines: ["remind1", "remind2", "remind3"]}],
                    items: ["Old pickaxe" ,"Old axe", "Old sickle"],
                    flags: ["is_gathering_unlocked", "is_crafting_unlocked"],
                },
                locks_lines: ["learn","leave"],
                is_unlocked: false,
            }),
            "leave": new Textline({
                name: "I'm not interested.",
                text: "Ahh, I see. Maybe some other time then, when you change your mind, hmm?",
                is_unlocked: false,
            }),
            
            "remind1": new Textline({
                name: "Could you remind me how to create equipment for myself?",
                text: "Ahh, of course. Unless you are talking about something simple like basic clothing, then you will first need to create components that can then be assembled together. "+
                "For weapons, you generally need a part that you use to hit an enemy and a part that you hold in your hand. For armor, you will need some actual armor and then something softer to wear underneath, "+
                "which would mostly mean some clothes.",
                is_unlocked: false,
            }),
            "remind2": new Textline({
                name: "Could you remind me how to improve my creations?",
                text: "Ahh, that's simple, you just need more experience. This alone will be a great boon to your efforts. For equipment, you might also want to start with better components. "+
                "After all, even with the most perfect assembling you can't turn a bent blade into a legendary sword.",
                is_unlocked: false,
            }),
            "remind3": new Textline({
                name: "Could you remind me how to get crafting materials?",
                text: "Ahh, there's multiple ways of that. You can gain them from fallen foes, you can gather them around, or you can even buy them if you have some spare coin.",
                is_unlocked: false,
            }),
        }
    });

    dialogues["village guard"] = new Dialogue({
        name: "village guard",
        is_unlocked: false,
        textlines: {
            "hello": new Textline({
                name: "Hello?",
                text: "Hello. I see you are finally leaving, huh?",
                unlocks: {
                    textlines: [{dialogue: "village guard", lines: ["tips", "job"]}],
                },
                locks_lines: ["hello"],
            }),
            "job": new Textline({
                name: "Do you maybe have any jobs for me?",
                is_unlocked: false,
                text: "You are somewhat combat capable now, so how about you help me and the boys on patrolling? Not much happens, but it pays better than working on fields",
                unlocks: {
                    activities: [{location:"Village", activity:"patrolling"}],
                },
                locks_lines: ["job"],
            }),
            "tips": new Textline({
                name: "Can you give me any tips for the journey?",
                is_unlocked: false,
                text: `First and foremost, don't rush. It's fine to spend some more time here, to better prepare yourself. `
                +`There's a lot of dangerous animals out there, much stronger than those damn rats, and in worst case you might even run into some bandits. `
                +`If you see something that is too dangerous to fight, try to run away.`,
                unlocks: {
                    textlines: [{dialogue: "village guard", lines: ["teach"]}],
                },
            }),
            "teach": new Textline({
                name: "Could you maybe teach me something that would be of use?",
                is_unlocked: false,
                text: `Lemme take a look... Yes, it looks like you know some basics. Do you know any proper techniques? No? I thought so. I could teach you the most standard three. `
                +`They might be more tiring than fighting the "normal" way, but if used in a proper situation, they will be a lot more effective. Two can be easily presented through `
                + `some sparring, so let's start with it. The third I'll just have to explain. How about that?`,
                unlocks: {
                    locations: ["Sparring with the village guard (quick)", "Sparring with the village guard (heavy)"],
                },
                locks_lines: ["teach"],
            }),
            "quick": new Textline({
                name: "So about the quick stance...",
                is_unlocked: false,
                text: `It's usually called "quick steps". As you have seen, it's about being quick on your feet. `
                +`While power of your attacks will suffer, it's very fast, making it perfect against more fragile enemies`,
                otherUnlocks: () => {
                    if(dialogues["village guard"].textlines["heavy"].is_finished) {
                        dialogues["village guard"].textlines["wide"].is_unlocked = true;
                    }
                },
                locks_lines: ["quick"],
                unlocks: {
                    stances: ["quick"]
                }
            }),
            "heavy": new Textline({
                name: "So about the heavy stance...",
                is_unlocked: false,
                text: `It's usually called "crushing force". As you have seen, it's about putting all your strength in attacks. ` 
                +`It will make your attacks noticeably slower, but it's a perfect solution if you face an enemy that's too tough for normal attacks`,
                otherUnlocks: () => {
                    if(dialogues["village guard"].textlines["quick"].is_finished) {
                        dialogues["village guard"].textlines["wide"].is_unlocked = true;
                    }
                },
                locks_lines: ["heavy"],
                unlocks: {
                    stances: ["heavy"]
                }
            }),
            "wide": new Textline({
                name: "What's the third technique?",
                is_unlocked: false,
                text: `It's usually called "broad arc". Instead of focusing on a single target, you make a wide swing to hit as many as possible. ` 
                +`It might work great against groups of weaker enemies, but it will also significantly reduce the power of your attacks and will be even more tiring than the other two stances.`,
                locks_lines: ["wide"],
                unlocks: {
                    stances: ["wide"]
                }
            }),
        }
    });

    dialogues["gate guard"] = new Dialogue({
        name: "gate guard",
        textlines: {
            "enter": new Textline({
                name: "Hello, can I get in?",
                text: "The town is currently closed to everyone who isn't a citizen or a guild member. No exceptions.",
            }), 
        }
    });
    dialogues["suspicious man"] = new Dialogue({
        name: "suspicious man",
        textlines: {
            "hello": new Textline({ 
                name: "Hello? Why are you looking at me like that?",
                text: "Y-you! You should be dead! *the man pulls out a dagger*",
                unlocks: {
                    locations: ["Fight off the assailant"],
                },
                locks_lines: ["hello"],
            }), 
            "defeated": new Textline({ 
                name: "What was that about?",
                is_unlocked: false,
                text: "I... We... It was my group that robbed you. I thought you came back from your grave for revenge... Please, I don't know anything. "
                +"If you want answers, ask my boss. He's somewhere in the town.",
                locks_lines: ["defeated"],
                unlocks: {
                    textlines: [{dialogue: "suspicious man", lines: ["behave"]}],
                },
            }), 
            "behave": new Textline({ 
                name: "Are you behaving yourself?",
                is_unlocked: false,
                text: "Y-yes! Please don't beat me again!",
                locks_lines: ["defeated"],
            }), 
        }
    });
    dialogues["farm supervisor"] = new Dialogue({
        name: "farm supervisor",
        textlines: {
            "hello": new Textline({ 
                name: "Hello",
                text: "Hello stranger",
                unlocks: {
                    textlines: [{dialogue: "farm supervisor", lines: ["things", "work", "animals", "fight", "fight0"]}],
                },
                locks_lines: ["hello"],
            }),
            "work": new Textline({
                name: "Do you have any work with decent pay?",
                is_unlocked: false,
                text: "We sure could use more hands. Feel free to help my boys on the fields whenever you have time!",
                unlocks: {
                    activities: [{location: "Town farms", activity: "fieldwork"}],
                },
                locks_lines: ["work"],
            }),
            "animals": new Textline({
                name: "Do you sell anything?",
                is_unlocked: false,
                text: "Sorry, I'm not allowed to. I could however let you take some stuff in exchange for physical work, and it just so happens our sheep need shearing.",
                required_flags: {yes: ["is_gathering_unlocked"]},
                unlocks: {
                    activities: [{location: "Town farms", activity: "animal care"}],
                },
                locks_lines: ["animals"],
            }),
            "fight0": new Textline({
                name: "Do you have any task that requires some good old violence?",
                is_unlocked: false,
                text: "I kinda do, but you don't seem strong enough for that. I'm sorry.",
                required_flags: {no: ["is_deep_forest_beaten"]},
            }),
            "fight": new Textline({
                name: "Do you have any task that requires some good old violence?",
                is_unlocked: false,
                text: "Actually yes. There's that annoying group of boars that keep destroying our fields. "
                + "They don't do enough damage to cause any serious problems, but I would certainly be calmer if someone took care of them. "
                + "Go to the forest and search for a clearing in north, that's where they usually roam when they aren't busy eating our crops."
                + "I can of course pay you for that, but keep in mind it won't be that much, I'm running on a strict budget here.",
                required_flags: {yes: ["is_deep_forest_beaten"]},
                unlocks: {
                    locations: ["Forest clearing"],
                },
                locks_lines: ["fight"],
            }),
            "things": new Textline({
                is_unlocked: false,
                name: "How are things around here?",
                text: "Nothing to complain about. Trouble is rare, pay is good, and the soil is as fertile as my wife!",
                unlocks: {
                    textlines: [{dialogue: "farm supervisor", lines: ["animals", "fight", "fight0"]}],
                }
            }), 
            "defeated boars": new Textline({
                is_unlocked: false,
                name: "I took care of those boars",
                text: "Really? That's great! Here, this is for you.",
                locks_lines: ["defeated boars"],
                unlocks: {
                    money: 1000,
                }
            }), 
        }
    });
	
dialogues["Sanctuary Gift"] = new Dialogue({
        name: "Sanctuary Gift",
        textlines: {
            "Sanctuary Gift": new Textline({ 
                name: "Sanctuary Gift",
                text: "Hello stranger, have free stuff",
                unlocks: {
                    items: ["Old pickaxe" ,"Old axe", "Old sickle"],
					traders: ["village trader"],
                    flags: ["is_gathering_unlocked", "is_crafting_unlocked"],
                },
                locks_lines: ["Sanctuary Gift"],
            }),
        }
    });
	
dialogues["Smith"] = new Dialogue({
        name: "Smith",
        textlines: {
            "Smith": new Textline({ 
                name: "Hello?",
                text: "Welcome to the finest workshop in this sprawling necropolis. Or rather the only one." 
				+ "Which means you'd better stay on my good side. Now, whatcha buying?",
                unlocks: {
					traders: ["smith trader"],
                },
                locks_lines: ["Smith"],
            }),
        }
    });
	
dialogues["Peddler"] = new Dialogue({
        name: "Peddler",
        textlines: {
            "Peddler": new Textline({ 
                name: "Hello?",
                text: "Welcome friend! Assuming you're here to buy something of course."
				+ "\n\nLife saving supplies, at reasonable prices. Ask about our “Don't Die Discount” today! Because an alive customer is a repeat customer!\n\n And if you're looking for something to do there's always need for farmhands.",
                unlocks: {
					traders: ["peddler"],
					activities: [{location: "Sanctuary", activity: "fieldwork"}]
                },
                locks_lines: ["Peddler"],
            }),
        }
    });
	

dialogues["Mad Lumberjack"] = new Dialogue({
        name: "Mad Lumberjack",
        textlines: {
            "Mad Lumberjack": new Textline({ 
                name: "Hello",
                text: "Boy!!!! Where's my lumber?",
                unlocks: {
					textlines: [{dialogue: "Mad Lumberjack", lines: ["LumberHuh"]}],
                },
                locks_lines: ["Mad Lumberjack"],
            }),
            "LumberHuh": new Textline({
				is_unlocked: false,
                name: "What?",
                text: "And where are your tools? Don't tell me you lost them again? Now, get to it.",
                unlocks: {
                    items: ["Old axe"],
                    flags: ["is_gathering_unlocked", "is_crafting_unlocked"],
                },
                locks_lines: ["LumberHuh"],
            }),
        }
    });
	
dialogues["Fisherman"] = new Dialogue({
        name: "Fisherman",
        textlines: {
            "Fisherman": new Textline({ 
                name: "Hello",
                text: "Good Mornin",
                unlocks: {
					textlines: [{dialogue: "Fisherman", lines: ["FishBiting","Rod"]}],
                },
            }),
            "FishBiting": new Textline({
				is_unlocked: false,
                name: "How's it going?",
                text: "Its a great day for fishing",
                unlocks: {
                },
            }),
			    "Rod": new Textline({
				is_unlocked: false,
                name: "Do you have a spare rod?",
                text: "Welcome to the world of fish",
                unlocks: {
                    items: ["Old rod"],
                },
                locks_lines: ["Rod"],
            }),
        }
    });
	
dialogues["Mad Miner"] = new Dialogue({
        name: "Mad Miner",
        textlines: {
            "Mad Miner": new Textline({ 
                name: "Hello",
                text: "Boy!!!! Where's my ore?",
                unlocks: {
					textlines: [{dialogue: "Mad Miner", lines: ["MinerHuh"]}],
                },
                locks_lines: ["Mad Miner"],
            }),
            "MinerHuh": new Textline({
				is_unlocked: false,
                name: "What?",
                text: "And where are your tools? Don't tell me you lost them again? Now, get to it.",
                unlocks: {
                    items: ["Old pickaxe"],
                },
                locks_lines: ["MinerHuh"],
            }),
        }
    });

dialogues["Mad Herbalist"] = new Dialogue({
        name: "Mad Herbalist",
        textlines: {
            "Mad Herbalist": new Textline({ 
                name: "Hello",
                text: "Boy!!!! Where's my herbs?",
                unlocks: {
					textlines: [{dialogue: "Mad Herbalist", lines: ["HerbHuh"]}],
                },
                locks_lines: ["Mad Herbalist"],
            }),
            "HerbHuh": new Textline({
				is_unlocked: false,
                name: "What?",
                text: "And where are your tools? Don't tell me you lost them again? Now, get to it.",
                unlocks: {
                    items: ["Old sickle"],
                },
                locks_lines: ["HerbHuh"],
            }),
        }
    });
	
dialogues["Fallen"] = new Dialogue({
        name: "Fallen",
        textlines: {
            "Fallen": new Textline({ 
                name: "Hello",
                text: "Another sorry bastard stumbling into town? You'll fit right in - we've got a fine pedigree of sad bastards here. Mad bastards, lost bastards, broken bastards, sick bastards. The full spread.",
				unlocks: {
					textlines: [{dialogue: "Fallen", lines: ["FallenWho"]}],
                },
				locks_lines: ["Fallen"],
			}),
            "FallenWho": new Textline({ 
				is_unlocked: false,
                name: "Who are you?",
                text: "A fallen bastard and nothing more. Used ta be some body and now I'm not.",
                unlocks: {
					textlines: [{dialogue: "Fallen", lines: ["FallenUsed"]}],
                },
                locks_lines: ["FallenWho"],
			}),	
            "FallenUsed": new Textline({ 
				is_unlocked: false,
                name: "Used to be?",
                text: "Used to be a hero. Sweat and bled for things. Then threw them away, and looking back I wonder why I ever cared. It was a stupid dream. But without it I dunno what to do with myself anymore.",
                unlocks: {
					textlines: [{dialogue: "Fallen", lines: ["FallenDone"]}],
                },
                locks_lines: ["FallenUsed"],
			}),	
            "FallenDone": new Textline({ 
				is_unlocked: false,
                name: "Uhm, good luck with that.",
                text: "Bah. Luck? Bah.",
                unlocks: {
                },
                locks_lines: ["FallenDone"],
			}),				
			}
    });
	
dialogues["Anthropologist"] = new Dialogue({
        name: "Anthropologist",
        textlines: {
            "Anthropologist": new Textline({ 
                name: "Hello",
                text: "Greetings. Have you come to admire these fine creatures? As the world's foremost anthropologist I'd love to share my findings with a fellow enthusiast.",
				unlocks: {
					textlines: [{dialogue: "Anthropologist", lines: ["Anthropology","Doing"]}],
                },
				locks_lines: ["Anthropologist"],
			}),
            "Anthropology": new Textline({ // 
				is_unlocked: false,
                name: "Anthropology? Are you sure that's the right word?",
                text: "Of course it is! Anthropology! Study of ants! What else would it mean?",
			}),	
            "Doing": new Textline({ 
				is_unlocked: false,
                name: "What are you doing here?",
                text: "There's rare breed of special ant that only be found here. A marvelous creature I've dubbed the Genetically Perfect Super Ant. Oh, it's as elusive as it is beautiful. The research value of such a specimen is incalculable!",
                unlocks: {
					textlines: [{dialogue: "Anthropologist", lines: ["KilledIt"]}],
                },
			}),	
            "KilledIt": new Textline({ 
				is_unlocked: false,
                name: "Killed it.",
                text: "What? Nooooooooo. How can the ultimate lifeform fall to someone so barbaric...",
				required_flags: {yes: ["is_rare_ant_killed"]},
                unlocks: {
					textlines: [{dialogue: "Anthropologist", lines: ["Final"]}],
                },
                locks_lines: ["KilledIt","Anthropology","Doing"],
			}),	
            "Final": new Textline({ 
				is_unlocked: false,
                name: "Well, a perfect ant is still an ant.",
                text: "You... you. You brute! You have no idea how much damage this will do to the cherished field of anthropology!",
                locks_lines: ["Final"],
				   unlocks: {
					textlines: [{dialogue: "Anthropologist", lines: ["Final"]}],
                },
			}),				
			}
    });
	
dialogues["Occultist"] = new Dialogue({
        name: "Occultist",
        textlines: {
            "Hello": new Textline({ 
                name: "Hello.",
                text: "Hmmmph. What brings you to this dark and dreary place, stranger?",
                unlocks: {
					textlines: [{dialogue: "Occultist", lines: ["Purposes","IDK"]}],
                },
                locks_lines: ["Hello"],
            }),
            "Purposes": new Textline({ 
                name: "My purposes are my own.",
                text: "Fine. Keep your secrets then. This place has plenty of them, and I know some aren't worth uncovering.\n\nSome though, some definitely ARE worth uncovering. Manuscripts and manuals, gruesome grimoires, tempting trinkets and frightful relics. They're the things that command my interest! If you come across any then I'll pay a high price for them.\n\nTrophies from remarkable foes as well. ",
				is_unlocked: false,
                unlocks: {
					textlines: [{dialogue: "Occultist", lines: ["Danger","Accept"]}],
                },
                locks_lines: ["Purposes","IDK"],
            }),
            "IDK": new Textline({ 
                name: "I don't know.",
                text: "Fine. Keep your secrets then. This place has plenty of them, and I know some aren't worth uncovering.\n\nSome though, some definitely ARE worth uncovering. Manuscripts and manuals, gruesome grimoires, tempting trinkets and frightful relics. They're the things that command my interest! If you come across any then I'll pay a high price for them.\n\nTrophies from remarkable foes as well. ",
				is_unlocked: false,
                unlocks: {
					textlines: [{dialogue: "Occultist", lines: ["Danger","Accept"]}],
                },
                locks_lines: ["Purposes","IDK"],
            }),
			 "Danger": new Textline({ 
                name: "Gruesome grimoires and frightful relics? Are those things not dangerous?",
                text: "All the more reason to sell them to me then, no?",
				is_unlocked: false,
            }),
			            "Accept": new Textline({ 
                name: "I’ll consider it",
                text: "Thank you, friend. Safe travels.",
				is_unlocked: false,
                unlocks: {
                },
            }),
        }
    });

dialogues["Gourmet"] = new Dialogue({
        name: "Gourmet Hunter",
        textlines: {
            "Hello": new Textline({ 
                name: "Hello",
                text: "Welcome. We could always use more hands for the hunt.",
				unlocks: {
					textlines: [{dialogue: "Gourmet", lines: ["Hunt"]}],
                },
				locks_lines: ["Hello"],
			}),
            "Hunt": new Textline({ // 
				is_unlocked: false,
                name: "The hunt?",
                text: "Yes, the hunt. For the Titan Turtle.",
								unlocks: {
					textlines: [{dialogue: "Gourmet", lines: ["Titan Turtle"]}],
                },
				locks_lines: ["Hunt"],
			}),	
            "Titan Turtle": new Textline({ 
				is_unlocked: false,
                name: "Titan Turtle?",
                text: "A great hulking beast captured centuries ago. An intrepid explorer of that era brought it back as a present for the Emperor, but the bloody thing escaped after making landfall and it's been wandering around ever since.",
                unlocks: {
					textlines: [{dialogue: "Gourmet", lines: ["Escape","Danger"]}],
					locations: ["Titan Turtle"],
                },
				locks_lines: ["Titan Turtle"],
			}),	
            "Escape": new Textline({ 
				is_unlocked: false,
                name: "How did it escape?",
                text: "Very slowly. But haste isn't necessary for nigh-invulnerable beasties.",
			}),	
			    "Danger": new Textline({ 
				is_unlocked: false,
                name: "Is it dangerous?",
                text: "Heavens no. It's slow plodding thing, and docile the bone. Does it have bones? I don't know!",
                unlocks: {
					textlines: [{dialogue: "Gourmet", lines: ["Why"]}],
                },
			}),	
			    "Why": new Textline({ 
				is_unlocked: false,
                name: "Why are you so determined to hunt it?",
                text: "Because it's *&£#ing delicious. Or that's the rumour anyway.",
			}),	
            "KilledIt": new Textline({ 
				is_unlocked: false,
                name: "The beast is slain.",
                text: "Great job. Now let's see if the taste  ",
                unlocks: {
					textlines: [{dialogue: "Gourmet", lines: ["Final"]}],
                },
			}),	
            "Final": new Textline({ 
				is_unlocked: false,
                name: "Well....",
                text: "It's quite... average. Even a little bland. *sigh*.... \n\n Take as much as you want, I'm not really feeling it. ",
                locks_lines: ["Final","KilledIt","Why","Danger","Escape"],
				unlocks: {
				items: [
					{ name: "Turtle Soup", count: 50 },
				],
                },
			}),				
			}
			
    });


dialogues["Scholar1"] = new Dialogue({
        name: "Scholar",
        textlines: {
            "Scholar1": new Textline({ 
                name: "Hello.",
                text: "This place is fraught with risk, but the rewards are commensurately high. The magics buried here could shake the world - they'd even put archmages to shame. I'm not so greedy as to want it all, but a tiny sliver would be life changing… Perhaps I can find something worthwhile just by skimming the surface. And avoiding the depths entirely. That's where the greatest dangers lie…",
                unlocks: {
					dialogues: ["Scholar2"],
                },
                locks_lines: ["Scholar1"],
            }),
        }
    });


dialogues["Scholar2"] = new Dialogue({
        name: "Scholar",
		is_unlocked: false,
        textlines: {
            "Scholar2": new Textline({ 
                name: "Hello.",
                text: "Oh, it's you. Are you copying my exploration strategy? Well, I don't mind - there's plenty of city left. Actually. One area of my investigations was thwarted by a magic resistant guardian. \n\nIf you're able to crush it with physical force then I'd be most grateful. I'd even offer tuition in the magical arts as compensation.",
                unlocks: {
					locations: ["Anti-Magic Golem"],
                },
                locks_lines: ["Scholar2"],
            }),
            "Scholar2Done": new Textline({ 
                name: "It's Done.",
				is_unlocked: false,
                text: "The way is clear? Excellent. I can't wait to see what I'll find. It seems you have some awareness of magic, now watch closely and I'll show you how to apply it in combat.",
                unlocks: {
					stances: ["magic"],
					dialogues: ["Scholar3"],
					magic: ["Magic Missile"],
                },
                locks_lines: ["Scholar2Done"],
            }),
        }
    });
	
dialogues["Scholar3"] = new Dialogue({
        name: "Scholar",
		is_unlocked: false,
        textlines: {
            "Scholar3": new Textline({ 
                name: "Find anything?",
                text: "I've made quite a discovery. Not in the field of magic I'm afraid, but in local history. This city was host to a grand experiment - a great magic to fend off death. Forever. Perhaps you already guessed as much? Clearly it didn't quite go as planned - but it's not like they were entirely unsuccessful either. But I digress. \n\nMy discovery is identifying the parties involved. It was an alliance of four great powers:\nThe Emperor \nThe Primordial Dragon \nThe Lord of Bones \nand.. there's no mention at all about the fourth party. \n\nThe records I found were very specific about the number of collaborators so my working theory is that the last group was deliberately purged from the records. Ponder for a moment why that might be the case. \n\n Ah, and here's something for your contributions.",
                unlocks: {
					items: ["Scholar trophy"],
					money: 500,
                },
                locks_lines: ["Scholar3"],
            }),
        }
    });

dialogues["Slayer1"] = new Dialogue({
        name: "Slayer",
        textlines: {
            "Slayer1": new Textline({ 
                name: "Hello.",
                text: "This place certainly lives up to its reputation. They warned me it was filled with countless monsters. All manner of horrible beasties..."
				+ "\n\nAnd what did I do?"
				+ "\n\nI threw back my head and laughed - “It does not matter!”. Haha."
				+ "\n\nNow, study this well if you want to follow the same path.",
                unlocks: {
					stances: ["wide"],
					dialogues: ["Slayer2"],
                },
                locks_lines: ["Slayer1"],
            }),
        }
    });
	
	
	

	
dialogues["Slayer2"] = new Dialogue({
        name: "Slayer",
		is_unlocked: false,
        textlines: {
            "Slayer2": new Textline({ 
                name: "Hello again.",
                text: "They told me it had monsters with rock hard armour.",
				unlocks: {
					textlines: [{dialogue: "Slayer2", lines: ["Slayer2Yes","Slayer2No"]}],
                },
				locks_lines: ["Slayer2"],
			}),
            "Slayer2Yes": new Textline({ 
				is_unlocked: false,
                name: "It does not matter!",
                text: "Yes, exactly! \n\n The tougher the shell the sweeter the yolk! Observe.",
                unlocks: {
					stances: ["heavy"],
					dialogues: ["Slayer3"],
                },
                locks_lines: ["Slayer2Yes","Slayer2No"],
			}),			
            "Slayer2No": new Textline({ 
				is_unlocked: false,
                name: "Sounds troublesome.",
                text: "No, no. Try again.",
			}),	
			}
    });
	
dialogues["Slayer3"] = new Dialogue({
        name: "Slayer",
		is_unlocked: false,
        textlines: {
            "Slayer3": new Textline({ 
                name: "Greetings.",
                text: "They told me it had beasts, nimble and swift.",
				unlocks: {
					textlines: [{dialogue: "Slayer3", lines: ["Slayer3Yes","Slayer3No"]}],
                },
				locks_lines: ["Slayer3"],
			}),
            "Slayer3Yes": new Textline({ 
				is_unlocked: false,
                name: "It does not matter!",
                text: "Yes, exactly! \n\n The fleet of foot will meet their deaths all the faster! Observe.",
                unlocks: {
					stances: ["quick"],
					dialogues: ["Slayer4"],
                },
                locks_lines: ["Slayer3Yes","Slayer3No"],
			}),			
            "Slayer3No": new Textline({ 
				is_unlocked: false,
                name: "Sounds troublesome.",
                text: "No, no. Try again.",
			}),	
			}
    });
	
	
dialogues["Slayer4"] = new Dialogue({
        name: "Slayer",
		is_unlocked: false,
        textlines: {
            "Slayer4": new Textline({ 
                name: "Hello again.",
                text: "They told me it had monsters that drove men to madness.",
				unlocks: {
					textlines: [{dialogue: "Slayer4", lines: ["Slayer4Yes","Slayer4No"]}],
                },
				locks_lines: ["Slayer4"],
			}),
            "Slayer4Yes": new Textline({ 
				is_unlocked: false,
                name: "It does not matter! ",
                text: "Yes, exactly! \n\n For madness and I are already well acquainted! Observe!",
                unlocks: {
					stances: ["berserk"],
					dialogues: ["Slayer5"],
                },
                locks_lines: ["Slayer4Yes","Slayer4No"],
			}),			
            "Slayer4No": new Textline({ 
				is_unlocked: false,
                name: "Sounds troublesome.",
                text: "No, no. Try again.",
			}),	
			}
    });

dialogues["Slayer5"] = new Dialogue({
        name: "Slayer",
		is_unlocked: false,
        textlines: {
            "Slayer5": new Textline({ 
                name: "Greetings.",
                text: "They told me it had fell creatures with inhuman strength.",
				unlocks: {
					textlines: [{dialogue: "Slayer5", lines: ["Slayer5Yes","Slayer5No"]}],
                },
				locks_lines: ["Slayer5"],
			}),
            "Slayer5Yes": new Textline({ 
				is_unlocked: false,
                name: "It does not matter!",
                text: "Yes, exactly! \n\n For even the gods tremble before my might! Observe!",
                unlocks: {
					stances: ["heaven"],
					dialogues: ["Slayer6"],
                },
                locks_lines: ["Slayer5Yes","Slayer5No"],
			}),			
            "Slayer5No": new Textline({ 
				is_unlocked: false,
                name: "Sounds scary.",
                text: "No, no. Try again.",
			}),	
			}
    });

dialogues["Slayer6"] = new Dialogue({
        name: "Slayer",
		is_unlocked: false,
        textlines: {
            "Slayer6": new Textline({ 
                name: "Are you okay?",
                text: "Even… when gravely wounded. \n\nAnd beset by enemies. \n\n\nIt does not…. Urk.",
				unlocks: {
					textlines: [{dialogue: "Slayer6", lines: ["Loot"]}],
                },
				locks_lines: ["Slayer6"],
			}),
			"Loot": new Textline({ 
                name: "*Loot the corpse*",
				is_unlocked: false,
                text: "You pick the body clean. It's what he would have wanted. \n\nProbably.",
				unlocks: {
					items: ["Slayer trophy"],
					money: 1000,
                },
				locks_lines: ["Loot"],
			}),
			}
    });
	
	
dialogues["ExpLeader"] = new Dialogue({
        name: "Expedition Leader",
		is_unlocked: true,
        textlines: {
            "Hello": new Textline({ 
                name: "Hello",
                text: "Hahaha. I just, I just need to hold on a little longer and reinforcements are sure to come. They wouldn't just leave me here.",
				unlocks: {
                },
				locks_lines: ["Hello"],
			}),
			}
    });
	
	
dialogues["Magus"] = new Dialogue({
        name: "Magus",
        textlines: {
           "Hello": new Textline({ 
                name: "Hello?",
                text: "Hmph. To think someone of my ability has to suffer the indignity of field research.\n\nYou. Help me in my endeavor. Collect the research papers scattered around the laboratory. As many as you can.",
				unlocks: {
					textlines: [{dialogue: "Magus", lines: ["What"]}],
                },
				locks_lines: ["Hello"],
			}),
           "What": new Textline({ 
                name: "What's in it for me?",
				is_unlocked: false,
                text: "Fool. Don't you appreciate this great opportunity? Aiding my research is an honor that others would kill for.\n\nFine, I can share some trivial magics with you if that expedites things. Is that what motivates petty adventurers?",
				unlocks: {
					textlines: [{dialogue: "Magus", lines: ["ClaimRewardStrengthen","ClaimRewardIceBeam","ClaimRewardMirrorImage","ClaimRewardTeleport","ClaimRewardRegen"]}],
                },
				locks_lines: ["What"],
			}),
           "ClaimRewardStrengthen": new Textline({ 
                name: "I have something for you. (Enhancement spell)",
				is_unlocked: false,
				requires_items: {
                item_template_key: "Research paper",
                quantity: 10
            },
                text: "Hmmph. At least you're useful for something.",
				unlocks: {
					magic: ["Strengthen"],
                },
				locks_lines: ["ClaimRewardStrengthen"],
			}),
			           "ClaimRewardMirrorImage": new Textline({ 
                name: "I have something for you (Illusion spell).",
				is_unlocked: false,
				requires_items: {
                item_template_key: "Research paper",
                quantity: 10
            },
                text: "Hmmph. What took you so long?",
				unlocks: {
					magic: ["Mirror Image"],
                },
				locks_lines: ["ClaimRewardMirrorImage"],
			}),
						 "ClaimRewardIceBeam": new Textline({ 
                name: "I have something for you (Damage spell).",
				is_unlocked: false,
				requires_items: {
                item_template_key: "Research paper",
                quantity: 10
            },
                text: "Hmmph. At least you're useful for something.",
				unlocks: {
					magic: ["Ice Beam"],
                },
				locks_lines: ["ClaimRewardIceBeam"],
			}),
									 "ClaimRewardTeleport": new Textline({ 
                name: "I have something for you (Utility spell).",
				is_unlocked: false,
				requires_items: {
                item_template_key: "Research paper",
                quantity: 10
            },
                text: "Hmmph. At least you're useful for something.",
				unlocks: {
					magic: ["Teleport"],
                },
				locks_lines: ["ClaimRewardTeleport"],
			}),
									 "ClaimRewardRegen": new Textline({ 
                name: "I have something for you (Healing spell).",
				is_unlocked: false,
				requires_items: {
                item_template_key: "Research paper",
                quantity: 10
            },
                text: "Hmmph. At least you're useful for something.",
				unlocks: {
					magic: ["Regen"],
                },
				locks_lines: ["ClaimRewardRegen"],
			}),
			
			
			
			
			}
    });

dialogues["Necromancer"] = new Dialogue({
        name: "Necromancer",
        textlines: {
           "Hello": new Textline({ 
                name: "Hello",
                text: "Ah, such a vast repository of fine materials. \n\nA little unfortunate that said materials are running amok on their own, but you can't have everything… \n\nAh, a visitor? Are you here to press the dead into your service as well? No matter, there are bones enough for the both of us.",
				unlocks: {
					textlines: [{dialogue: "Necromancer", lines: ["What"]}],
                },
				locks_lines: ["Hello"],
			}),
           "What": new Textline({ 
                name: "What are you doing?",
				is_unlocked: false,
                text: "Raising high quality undead. Or trying to.\n\nI've had a few setbacks, but these materials are worth great effort.",
				unlocks: {
					textlines: [{dialogue: "Necromancer", lines: ["Setback"]}],
                },
				locks_lines: ["What"],
			}),
           "Setback": new Textline({ 
                name: "Setbacks?",
				is_unlocked: false,
                text: "The undead here are too wilful to assert control over. And vanquishing them, to raise them once more… presents some challenges as well.",
				unlocks: {
					textlines: [{dialogue: "Necromancer", lines: ["Help"]}],
                },
				locks_lines: ["Setback"],
			}),
			      "Help": new Textline({ 
                name: "Need some help?",
				is_unlocked: false,
                text: "Hmmm. If that's a sincere offer, then retrieving some materials to get me started would make a world of difference. But what kind of price would you demand in return?",
				unlocks: {
					textlines: [{dialogue: "Necromancer", lines: ["Necromancy"]}],
                },
				locks_lines: ["Help"],
			}),
			      "Necromancy": new Textline({ 
                name: "Then teach me about necromancy.",
				is_unlocked: false,
                text: "Hmmm. I'm loath to part with my secrets… but said secrets are worth little if I can't put them into practice….\n\nFine. I accept your bargain.\n\n 5 elite skulls, and I shall impart the miracle of raising the dead.",
				unlocks: {
					textlines: [{dialogue: "Necromancer", lines: ["ClaimReward"]}],
                },
				locks_lines: ["Necromancy"],
			}),
			
					      "ClaimReward": new Textline({ 
                name: "Here you go. (Give items)",
				is_unlocked: false,
				   requires_items: {
                item_template_key: "Elite skull",
                quantity: 5
            },
                text: "Excellent! \n\nNow, watch closely, apprentice. \n\n And rembember, with great power comes great opportunity to abuse that power bwahaha.",
				unlocks: {
					magic: ["Raise Dead"],
                },
				locks_lines: ["ClaimReward"],
			}),
			}
    });
	
	
	



	
	
dialogues["Fireseeker1"] = new Dialogue({
        name: "Fire Seeker",
        textlines: {
           "Fireseeker1": new Textline({ 
                name: "Hello",
                text: "Traveller. Do you seek fame and fortune? Then let me flaunt an opportunity. A great prize slumbers in the depths here, and I intend to retrieve it. \n\nFor that I need the most capable escorts. If you are up to the task then I shall see that you are well compensated for your efforts.",
				unlocks: {
					textlines: [{dialogue: "Fireseeker1", lines: ["Fireseeker1Query"]}],
                },
				locks_lines: ["Fireseeker1"],
			}),
           "Fireseeker1Query": new Textline({ 
                name: "What's the ‘prize’?",
				is_unlocked: false,
                text: "Hmmm. A secret! Reserved for those that see the expedition out to the end.",
				unlocks: {
					textlines: [{dialogue: "Fireseeker1", lines: ["Fireseeker1Agree"]}],
                },
				locks_lines: ["Fireseeker1Query"],
			}),
           "Fireseeker1Agree": new Textline({ 
                name: "I'm in",
				is_unlocked: false,
                text: "Excellent! Assemble in the Caverns.",
				unlocks: {
					dialogues: ["Fireseeker2"],
                },
				locks_lines: ["Fireseeker1Agree"],
			}),
			}
    });
	
dialogues["Fireseeker2"] = new Dialogue({
        name: "Fire Seeker",
		is_unlocked: false,
        textlines: {
           "Fireseeker2": new Textline({ 
                name: "Hello again.",
                text: "Is this… is this all that answered the call? I see…\n\nI… cannot turn back. So…, so that just means you get a greater share of the rewards. Please help me see this through to the end. \n\nNow, my knight, cut us a path deeper.",
				unlocks: {
					dialogues: ["Fireseeker3"],
                },
				locks_lines: ["Fireseeker2"],
			}),
			}
    });
	
dialogues["Fireseeker3"] = new Dialogue({
        name: "Fire Seeker",
		is_unlocked: false,
        textlines: {
           "Fireseeker3": new Textline({ 
                name: "Hello again.",
                text: "My knight, obliterate these disgusting bugs.",
				unlocks: {
					dialogues: ["Fireseeker4"],
                },
				locks_lines: ["Fireseeker3"],
			}),
			}
    });

dialogues["Fireseeker4"] = new Dialogue({
        name: "Fire Seeker",
		is_unlocked: false,
        textlines: {
           "Fireseeker4": new Textline({ 
                name: "Hello again.",
                text: "Not much further, my knight",
				required_flags: {yes: ["is_ant_hive_beaten"]},
				unlocks: {
					dialogues: ["Fireseeker5"],
                },
				locks_lines: ["Fireseeker4"],
			}),
			}
    });
	
dialogues["Fireseeker5"] = new Dialogue({
        name: "Fire Seeker",
		is_unlocked: false,
        textlines: {
           "Fireseeker5": new Textline({ 
                name: "Hello again.",
                text: "Look! A sliver of primordial fire, stolen from the depths of the earth. Dancing and flickering in my hands. I don't know what quality of flames my sisters found, but surely this one will win. With this my place is assured. And you've earned your prize. \n\nThank you.",
				unlocks: {
					items: ["Fireseeker trophy"],
					money: 1000,
					magic: ["Fireball"],
                },
				locks_lines: ["Fireseeker5"],
			}),
			}
    });
	
dialogues["Kon1"] = new Dialogue({
        name: "Knight",
        textlines: {
            "Kon1": new Textline({ 
                name: "Hello",
                text: "“So, I'm not the only one who dares to challenge this place. Seems the world has no shortage of fools. Hah.",
				unlocks: {
					textlines: [{dialogue: "Kon1", lines: ["Kon1Who","Kon1What","Kon1Advice"]}],
                },
			}),
				"Kon1Who": new Textline({ 
				is_unlocked: false,
                name: "Who’re you?",
                text: "I'm a masterless sword. A crusader without a cause. The Knight of Nothing. Wandering the world to find some great evil to vanquish. And I daresay I came to the right place, this whole city is rotten.",
			}),
				"Kon1What": new Textline({ 
				is_unlocked: false,
                name: "What do you know about this place?",
                text: "A cursed land full of restless dead. And worse things, if the tales are to be believed. Just the place where cold hard steel might do some good.",
					unlocks: {
					textlines: [{dialogue: "Kon1", lines: ["Kon1Cause"]}],
                },
			}),
				"Kon1Cause": new Textline({ 
				is_unlocked: false,
                name: "What kind of ‘cause’ are you looking for?",
                text: "Anything really. I've found no dragons to slay, no demons to exorcise. The closest thing I've found to monsters were other people, and I knew that I could be as monstrous as any of them. \n\nWhich is why this place is so promising - I'm certain it houses the monsters that I seek.",
				unlocks: {
					textlines: [{dialogue: "Kon1", lines: ["Kon1Final"]}],
                },
			}),
			"Kon1Advice": new Textline({ 
				is_unlocked: false,
                name: "Any advice?",
                text: "Prepare yourself thoroughly before diving too deep. I believe there's a settlement of sorts somewhere around here, a place where wanderers gather for shared safety. If there is such a place then surely they'll offer supplies for the brave and errands for the earnest. \n\n Warming yourself up a bit before you get to fighting is an idea too.",
			}),
			"Kon1Final": new Textline({ 
				is_unlocked: false,
                name: "Goodbye",
                text: "Well, adventure calls. Hopefully neither of us stumbles into an early grave! Hah. \n\n Oh and perhaps you'll find some use for this. A parting gift!",
				unlocks: {
					dialogues: ["Kon2"],
					items: [
					{ name: "Cheap iron sword", quality: 50 },
					
				],
                },
            locks_lines: ["Kon1","Kon1What","Kon1Who","Kon1Final","Kon1Advice","Kon1Cause"],
            }),
        }
    });
	
dialogues["Kon2"] = new Dialogue({
        name: "Knight of Nothing",
		is_unlocked: false,
        textlines: {
            "Kon2": new Textline({ 
                name: "Hello again.",
                text: "Seeing a city in ruins... "
				+ "It's an odd experience. Feels like I didn't properly appreciate all the towns and cities I've visited? "
				+ "\n\nMy hometown couldn't be much smaller than this one, yet I could hardly tell you a thing about it. Streets I've walked a thousand times, without ever being able to say what was on them - just knowing that they were full of things not meant for me. "
				+ "\n\nApologies, I've said something strange.",
				unlocks: {
					dialogues: ["Kon3"],
                },
				locks_lines: ["Kon2"],
			}),
			}
    });

dialogues["Kon3"] = new Dialogue({
        name: "Knight of Nothing",
		is_unlocked: false,
        textlines: {
		"Kon3": new Textline({ 
            name: "Greetings.",
            text: "Heaven's, there's no end to these creatures. I thought they'd be thinning out by now, but their numbers haven't changed at all.\n\nI'm no slouch when it comes to endurance, but even my stamina is at its limits now.",
            unlocks: {
                textlines: [{dialogue: "Kon3", lines: ["Kon3_help","Kon3_nohelp"]}],
                stances: ["defensive"],
            },
            locks_lines: ["Kon3"],
        }),
        "Kon3_help": new Textline({
            name: "This may help. (Give 5 stale bread)",
            text: "You really have supplies to spare? Very well, I accept.\n\n Now let's see what I can do to earn my keep. \n\n Aha! Let me acompany you for a time, and I'll instruct you in the ways of knightly combar. After all, we're comrades that have broken bread together.",
			is_unlocked: false,
            requires_items: {
                item_template_key: "Stale bread",
                quantity: 5
            },
            unlocks: {
                dialogues: ["Kon4"],
                stances: ["defensive"],
				allies: ["knight"],
            },
            locks_lines: ["Kon3_help", "Kon3_nohelp"]
        }),
		        "Kon3_nohelp": new Textline({ 
            name: "Need some help?",
            text: "Frankly yes. But it's mainly supplies I need. Even stale bread will do at this point.",
			is_unlocked: false,
        }),
	}
    });
	
dialogues["Kon4"] = new Dialogue({
        name: "Knight of Nothing",
		is_unlocked: false,
        textlines: {
            "Kon4": new Textline({ 
                name: "Hello again.",
                text: "These brushes with death have prompted much self-reflection. Seems mortal threats really do make your life flash before your eyes…. \n\nI.. am a man with little attachment to things. I thought that was what made me strong - that I was willing to sacrifice what others could not. So many things that make the world turn that I always found meaningless. And without those distractions I thought I could attain unrivaled strength. \n\nAnd now I wonder if I was mistaken the whole time.",
				unlocks: {
					dialogues: ["Kon5"],
                },
				locks_lines: ["Kon4"],
			}),
			}
    });
	
dialogues["Kon5"] = new Dialogue({
        name: "Knight of Nothing",
		is_unlocked: false,
        textlines: {
            "Kon5": new Textline({ 
                name: "Hello again.",
                text: "I think... I'll find something else to do with my life. Don't know what or where, but even the humblest cause beats marching to my death. \n\nHere friend, take this. \n\nAnd if we do meet again, I suppose I'll need a new way to introduce myself. The knight of something! Hah.",
				unlocks: {
					items: ["Knight trophy"],
					money: 100,
					expels: ["knight"],
                },
				locks_lines: ["Kon5"],
			}),
			}
    });

})();

dialogues["Chain-Saw Demon"] = new Dialogue({
        name: "Chain-Saw Demon",
		is_finished: true,
        textlines: {
            "Chain-Saw Demon": new Textline({
                name: "uhh hello?",
                is_unlocked: true,
                text: "wrrryyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
                required_flags: {yes: ["is_chain_demon_beaten","is_saw_demon_beaten"]},
                unlocks: {
                    locations: ["Chain-Saw Demon"],
                },
                locks_lines: ["Chain-Saw Demon"],
							}),
			}
    });

dialogues["Shadow"] = new Dialogue({
        name: "Shadow",
		//required_flags: {yes: ["is_hero_level10"]},
        textlines: {
            "Shadow1": new Textline({
                name: "uhh hello?",
                is_unlocked: true,
                text: "Ignorant vessel. Put your foolish ambitions to rest.",
                required_flags: {yes: ["is_hero_level10"]},
                unlocks: {
                    locations: ["Shadow1"],
                },
                locks_lines: ["Shadow1"],
							}),
			"Shadow2": new Textline({
                name: "?",
                is_unlocked: false,
                text: "Your struggle is futile, your efforts are pointless. \n\nThere are forces here that are forever beyond you. Accept the mercy of crushing defeat.",
                required_flags: {yes: ["is_hero_level20"]},
				unlocks: {
                    locations: ["Shadow2",],
                },
                locks_lines: ["Shadow2"],
							}),
			"Shadow3": new Textline({
                name: "?",
                is_unlocked: false,
                text: "If you continue then you will die here. Again. And again. And again. And again. And again. And again. And again. Even if you have the capacity to remake yourself, you will be destroyed so many times that you forget what you even are. Perhaps you already have.",
                unlocks: {
                    locations: ["Shadow3"],
                },
                locks_lines: ["Shadow3"],
							}),
			"Shadow4": new Textline({
                name: "?",
                is_unlocked: false,
                text: "Do not face the impossible. Do not struggle against the inevitable. Do not defy the absolute. Do not. Do not. Do not. Do not. Do not.",
                unlocks: {
                    locations: ["Shadow4"],
                },
                locks_lines: ["Shadow4"],
							}),
			"Shadow5": new Textline({
                name: "?",
                is_unlocked: false,
				required_flags: {yes: ["is_hero_level50"]},
                text: "Sweet oblivion beckons to me. May it swallow you as well.",
                unlocks: {
                    locations: ["Shadow5","Saw Demon","Chain Demon"],
                },
                locks_lines: ["Shadow5"],
							}),
			}
    });
	


export {dialogues};