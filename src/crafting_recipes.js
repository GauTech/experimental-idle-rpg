"use strict";

import { character, get_total_skill_level } from "./character.js";
import { Armor, ArmorComponent, Shield, ShieldComponent, Weapon, WeaponComponent, item_templates } from "./items.js";
import { skills } from "./skills.js";

const crafting_recipes = {items: {}, components: {}, equipment: {}};
const cooking_recipes = {items: {}};
const smelting_recipes = {items: {}};
const forging_recipes = {items: {}, components: {}};
const alchemy_recipes = {items: {}};

/*
    recipes can be treated differently for display based on if they are in items/components/equipment category

    non-equipment recipes have a success rate (presented with min-max value, where max should be 1) that shall scale with skill level and with crafting station level
    for equipment recipes, there is no success rate in favor of equipment's "quality" property

    resulting quality of equipment is based on component quality; 100% (with slight variation) with 100% components and required skill, more at higher levels
    
    overal max quality achievable scales with related skills
*/

function get_crafting_quality_caps(skill_name, tier = 0) {
    const skill_cap_components = Math.round(100 + 2 * get_total_skill_level(skill_name));
    const skill_cap_equipment = Math.round(100 + 2.8 * get_total_skill_level(skill_name));
    const tier_cap = 130 + (tier * 20);

    return {
        components: Math.min(skill_cap_components, tier_cap, 200),
        equipment: Math.min(skill_cap_equipment, tier_cap, 250),
    };
}

class Recipe {
    constructor({
        name,
        id,
        is_unlocked = true, //TODO: change to false when unlocking is implemented!
        recipe_type,
        result, //{name, count}
        getResult,
        recipe_level = [1,1],
        recipe_skill,
    }) {
        this.name = name;
        this.id = id || name;
        this.is_unlocked = is_unlocked;
        this.recipe_type = recipe_type;
        this.result = result;
        this.getResult = getResult || function(){return this.result};
        this.recipe_level = recipe_level;
        this.recipe_skill = recipe_skill;
    }
}

class ItemRecipe extends Recipe {
    constructor({
        name,
        id,
        materials = [], //{name, count}
        is_unlocked = true,
        recipe_type,
        result, //{name, count}
        getResult,
        recipe_level,
        recipe_skill,
        success_chance = [1,1],
    }) {
        super({name, id, is_unlocked, recipe_type, result, getResult, recipe_level, recipe_skill});
        this.materials = materials;
        this.success_chance = success_chance;
        if(this.success_chance[0]==0){
            this.success_chance[0] = 0.1;
        }
    }

    get_success_chance(station_tier=1) {
        const level = Math.min(this.recipe_level[1]-this.recipe_level[0]+1, Math.max(0,get_total_skill_level(this.recipe_skill)-this.recipe_level[0]+1));
        const skill_modifier = Math.min(1,(0||(level+(station_tier-1))/(this.recipe_level[1]-this.recipe_level[0]+1)));
        return this.success_chance[0]*(this.success_chance[1]/this.success_chance[0])**skill_modifier;
    }

    get_availability() {
        let ammount = Infinity;
        let materials = [];
        for(let i = 0; i < this.materials.length; i++) {
            if(this.materials[i].material_id) {
                const key = item_templates[this.materials[i].material_id].getInventoryKey();
                if(!character.inventory[key]) {
                    return 0;
                }
                ammount = Math.floor(Math.min(character.inventory[key].count / this.materials[i].count, ammount));
            } else if (this.materials[i].material_type) {
                let mats = [];

                //going through possible items and checking for their presence would surely be faster
                Object.keys(character.inventory).forEach(key => {
                    if(character.inventory[key].item.material_type === this.materials[i].material_type && character.inventory[key].count >= this.materials[i].count) {
                        mats.push(character.inventory[key]);
                    }
                });
                if(mats.length == 0) {
                    return 0;
                }

                mats = mats.sort((a,b) => a.item.getValue()-b.item.getValue());
                ammount = Math.floor(Math.min(mats[0].count / this.materials[i].count, ammount));
                materials.push(mats[0].item.id);
            }
        }
        
        return {available_ammount: ammount, materials};
    }
}

class ComponentRecipe extends ItemRecipe{
    constructor({
        name,
        id,
        materials = [], 
        is_unlocked = true,
        result, //{item, count, result_name} where result_name is an item_templates key
        component_type,
        recipe_skill,
        item_type,
    }) {
        super({name, id, materials, is_unlocked, recipe_type: "component", result, recipe_level: [1,1], recipe_skill, getResult: null, success_rate: [1,1]})
         this.component_type = component_type;
        this.item_type = item_type;

        this.getResult = function(material, station_tier = 1){
            const result = item_templates[this.materials.find(x => x.material_id === material.id).result_id];
            const result_tier = result.component_tier ?? 1;
            const quality = this.get_quality(station_tier - result_tier, result);

            if(result.tags["clothing"]) {
                return new Armor({...result, quality});
            } else if(result.tags["armor component"]) {
                return new ArmorComponent({...result, quality});
            } else if(result.tags["weapon component"]) {
                return new WeaponComponent({...result, quality});
            } else if(result.tags["shield component"]) {
                return new ShieldComponent({...result, quality});
            } else {
                throw new Error(`Component recipe ${this.name} does not produce a valid result!`);
            }
        };
    }

    get_quality_range(tier_offset = 0, result_item = null) {
        const skill = skills[this.recipe_skill];
        const result_tier = result_item?.component_tier ?? 1;

        const quality = (130 + (3 * get_total_skill_level(this.recipe_skill) - skill.max_level) + (15 * tier_offset)) / 100;
        const cap = this.get_quality_cap(result_tier);

        return [
            Math.max(10, Math.min(cap, Math.round(25 * (quality - 0.15)) * 4)),
            Math.max(10, Math.min(cap, Math.round(25 * (quality + 0.1)) * 4))
        ];
    }

    get_quality_cap(result_tier = 1) {
        const caps = get_crafting_quality_caps(this.recipe_skill, result_tier);
        return this.item_type === "Armor" ? caps.equipment : caps.components;
    }

    get_quality(tier_offset = 0, result_item = null) {
        const quality_range = this.get_quality_range(tier_offset, result_item);
        return Math.round(((quality_range[1] - quality_range[0]) * Math.random() + quality_range[0]) / 4) * 4;
    }

    get_is_quality_capped(result_item) {
        const quality_range = this.get_quality_range(0, result_item);
        return quality_range[0] >= this.get_quality_cap(result_item?.component_tier ?? 1);
    }
}

class EquipmentRecipe extends Recipe {
    constructor({
        name,
        id,
        components = [], //pair of component types; first letter not capitalized; blade-handle or internal-external
        is_unlocked = true,
        result = null,
        recipe_skill = "Crafting",
        item_type, //Weapon/Armor/Shield
        //no recipe level, difficulty based on selected components
    }) {
        super({name, id, is_unlocked, recipe_type: "equipment", result, getResult: null, recipe_level: [1,1], recipe_skill, success_rate: [1,1]})
        this.components = components;
        this.item_type = item_type;
        this.getResult = function(component_1, component_2, station_tier = 1){
            const comp_quality_weighted = this.get_component_quality_weighted(component_1, component_2);
            let quality = this.get_quality(
				comp_quality_weighted,
				component_1,
				component_2,
				(station_tier - Math.max(component_1.component_tier, component_2.component_tier)) || 0
			);
						
            //return based on components used
            if(this.item_type === "Weapon") {
                return new Weapon(
                    {
                        components: {
                            head: component_1.id,
                            handle: component_2.id,
                        },
                        quality: quality,
                    }
                );
            } else if(this.item_type === "Armor") {
                return new Armor(
                    {
                        components: {
                            internal: component_1.id,
                            external: component_2.id,
                        },
                        quality: quality,
                    }
                );
            } else if(this.item_type === "Shield") {
                return new Shield(
                    {
                        components: {
                            shield_base: component_1.id,
                            handle: component_2.id,
                        },
                        quality: quality,
                    }
                );
            } else {
                throw new Error(`Recipe "${this.name}" has an incorrect item_type provided ("${this.item_type}")`);
            }
        }
    }

		get_quality_cap(component_1, component_2) {
			const lowest_tier = Math.min(component_1.component_tier, component_2.component_tier);
			return get_crafting_quality_caps(this.recipe_skill, lowest_tier).equipment;
		}

		get_quality_range(component_quality, component_1, component_2, station_tier = 0) {
			const skill = skills[this.recipe_skill];
			const lowest_tier = Math.min(component_1.component_tier, component_2.component_tier);
			const quality = (50 + component_quality + (3 * get_total_skill_level(this.recipe_skill) - skill.max_level) + 10 * (station_tier));
			const cap = get_crafting_quality_caps(this.recipe_skill, lowest_tier).equipment;
			return [
				Math.max(10, Math.min(cap, Math.round(quality - 15))),
				Math.max(10, Math.min(cap, Math.round(quality + 15)))
			];
		}

		get_quality(component_quality, component_1, component_2, station_tier = 0) {
			const quality_range = this.get_quality_range(component_quality, component_1, component_2, station_tier);
			return Math.round(((quality_range[1] - quality_range[0]) * Math.random() + quality_range[0]) / 2) * 2;
		}

    get_component_quality_weighted(component_1, component_2) {
        return (component_1.quality*component_1.component_tier + component_2.quality*component_2.component_tier)/(component_1.component_tier+component_2.component_tier);
    }
}

function get_tier_limited_comp_quality_cap(tier = 1) {
	const tier_limited_comp_quality_cap = 130 + (tier * 20);
    return tier_limited_comp_quality_cap;
}

function get_tier_limited_product_quality_cap({component1_tier, component2_tier}) {
	const tier_limited_product_quality_cap = Math.min(130+(component1_tier*20), 130+(component2_tier*20));
    return tier_limited_product_quality_cap;
}

function get_recipe_xp_value({category, subcategory, recipe_id, material_count, result_tier, selected_components, rarity_multiplier}) {
    //
    //for components: multiplied by material count (so every component of same tier is equally profitable to craft)
    //for equipment: based on component tier average
    if(!category || !subcategory || !recipe_id) {
        //shouldn't be possible to reach this
        throw new Error(`Tried to use a recipe but either category, subcategory, or recipe id was not passed: ${category} - ${subcategory} - ${recipe_id}`);
    }
    let exp_value = 8;
    const selected_recipe = recipes[category][subcategory][recipe_id];
    const skill_level = skills[selected_recipe.recipe_skill].current_level;
    if(!selected_recipe) {
        throw new Error(`Tried to use a recipe that doesn't exist: ${category} -> ${subcategory} -> ${recipe_id}`);
    }
    if(subcategory === "items") {
        exp_value = Math.round((skills["Scrap Mechanic"].get_coefficient("multiplicative"))* Math.max(exp_value,1.5*selected_recipe.recipe_level[1],1.2**selected_recipe.recipe_level[1]));
        //maybe scale with materials needed?
        
        if(selected_recipe.recipe_level[1] < skill_level) {
            exp_value = (Math.max(1,exp_value * Math.max(0,Math.min(5,(selected_recipe.recipe_level[1]+6-skill_level))/5)));
        }
    } else if (subcategory === "components" || selected_recipe.recipe_type === "component") {
        const result_level = 8*result_tier

        exp_value = Math.max(exp_value,result_tier * 4 * material_count, 1.3**(result_tier * Math.min(material_count,5)));
        exp_value = Math.round(Math.max(1,(skills["Scrap Mechanic"].get_coefficient("multiplicative"))* exp_value*(rarity_multiplier**0.5 - (skill_level/result_level))*rarity_multiplier));
    } else {
        const result_level =  8*Math.max(selected_components[0].component_tier,selected_components[1].component_tier);
        exp_value = Math.max(exp_value,(selected_components[0].component_tier+selected_components[1].component_tier) * 4,1.2**(selected_components[0].component_tier+selected_components[1].component_tier) * 4);
        exp_value = Math.round(Math.max(1,(skills["Scrap Mechanic"].get_coefficient("multiplicative"))*exp_value*(rarity_multiplier**0.5 - (skill_level/result_level))*rarity_multiplier));
    }

    return Math.round(exp_value);
}

//weapon components
(()=>{
forging_recipes.components["Short blade"] = new ComponentRecipe({
    name: "Short blade",
    materials: [
        {material_id: "Low quality iron ingot", count: 2, result_id: "Cheap short iron blade"}, 
        {material_id: "Iron ingot", count: 2, result_id: "Short iron blade"},
        {material_id: "Blacksteel ingot", count: 2, result_id: "Short blacksteel blade"},
        {material_id: "Mithril ingot", count: 2, result_id: "Short mithril blade"},
		{material_id: "Platinum Shard", count: 5, result_id: "Short platinum blade"}
    ],
    item_type: "Component",
    recipe_skill: "Forging"
});

forging_recipes.components["Long blade"] = new ComponentRecipe({
    name: "Long blade",
    materials: [
        {material_id: "Low quality iron ingot", count: 3, result_id: "Cheap long iron blade"}, 
        {material_id: "Iron ingot", count: 3, result_id: "Long iron blade"},
        {material_id: "Blacksteel ingot", count: 3, result_id: "Long blacksteel blade"},
        {material_id: "Mithril ingot", count: 3, result_id: "Long mithril blade"},
		{material_id: "Order Badge", count: 8, result_id: "Order Blade"},
		{material_id: "Platinum Shard", count: 10, result_id: "Long platinum blade"}
    ],
    item_type: "Component",
    recipe_skill: "Forging",
});

forging_recipes.components["Axe head"] = new ComponentRecipe({
    name: "Axe head",
    materials: [
        {material_id: "Low quality iron ingot", count: 4, result_id: "Cheap iron axe head"}, 
        {material_id: "Iron ingot", count: 4, result_id: "Iron axe head"},
        {material_id: "Blacksteel ingot", count: 4, result_id: "Blacksteel axe head"},
        {material_id: "Mithril ingot", count: 4, result_id: "Mithril axe head"},
		{material_id: "Platinum Shard", count: 15, result_id: "Platinum axe head"}
    ],
    item_type: "Component",
    recipe_skill: "Forging"
});

forging_recipes.components["Hammer head"] = new ComponentRecipe({
    name: "Hammer head",
    materials: [
        {material_id: "Low quality iron ingot", count: 4, result_id: "Cheap iron hammer head"}, 
        {material_id: "Iron ingot", count: 4, result_id: "Iron hammer head"},
        {material_id: "Blacksteel ingot", count: 4, result_id: "Blacksteel hammer head"},
        {material_id: "Mithril ingot", count: 4, result_id: "Mithril hammer head"},
		{material_id: "Platinum Shard", count: 15, result_id: "Platinum hammer head"}
    ],
    item_type: "Component",
    recipe_skill: "Forging",
});

forging_recipes.components["Short hilt"] = new ComponentRecipe({
    name: "Short hilt",
    materials: [
        {material_id: "Low quality iron ingot", count: 1, result_id: "Cheap short iron hilt"},
        {material_id: "Iron ingot", count: 1, result_id: "Short iron hilt"},
        {material_id: "Blacksteel ingot", count: 1, result_id: "Short blacksteel hilt"},
        {material_id: "Mithril ingot", count: 1, result_id: "Short mithril hilt"}
    ],
    item_type: "Component",
    recipe_skill: "Forging",
});

forging_recipes.components["Medium handle"] = new ComponentRecipe({
    name: "Medium handle",
    materials: [
        {material_id: "Low quality iron ingot", count: 2, result_id: "Cheap medium iron handle"},
        {material_id: "Iron ingot", count: 2, result_id: "Medium iron handle"},
        {material_id: "Blacksteel ingot", count: 2, result_id: "Medium blacksteel handle"},
        {material_id: "Mithril ingot", count: 2, result_id: "Medium mithril handle"}
    ],
    item_type: "Component",
    recipe_skill: "Forging",
});

forging_recipes.components["Long shaft"] = new ComponentRecipe({
    name: "Long shaft",
    materials: [
        {material_id: "Low quality iron ingot", count: 4, result_id: "Cheap long iron shaft"},
        {material_id: "Iron ingot", count: 4, result_id: "Long iron shaft"},
        {material_id: "Blacksteel ingot", count: 4, result_id: "Long blacksteel shaft"},
        {material_id: "Mithril ingot", count: 4, result_id: "Long mithril shaft"}
    ],
    item_type: "Component",
    recipe_skill: "Forging",
});

crafting_recipes.components["Short hilt"] = new ComponentRecipe({
    name: "Short hilt",
    materials: [
        {material_id: "Processed rough wood", count: 1, result_id: "Simple short wooden hilt"},
        {material_id: "Processed wood", count: 1, result_id: "Short wooden hilt"},
        {material_id: "Processed ash wood", count: 1, result_id: "Short ash wood hilt"},
        {material_id: "Processed mahogany wood", count: 1, result_id: "Short mahogany wood hilt"}
    ],
    item_type: "Component",
    recipe_skill: "Crafting",
});

crafting_recipes.components["Medium handle"] = new ComponentRecipe({
    name: "Medium handle",
    materials: [
        {material_id: "Processed rough wood", count: 2, result_id: "Simple medium wooden handle"},
        {material_id: "Processed wood", count: 2, result_id: "Medium wooden handle"},
        {material_id: "Processed ash wood", count: 2, result_id: "Medium ash wood handle"},
        {material_id: "Processed mahogany wood", count: 2, result_id: "Medium mahogany wood handle"}
    ],
    item_type: "Component",
    recipe_skill: "Crafting",
});

crafting_recipes.components["Long shaft"] = new ComponentRecipe({
    name: "Long shaft",
    materials: [
        {material_id: "Processed rough wood", count: 4, result_id: "Simple long wooden shaft"},
        {material_id: "Processed wood", count: 4, result_id: "Long wooden shaft"},
        {material_id: "Processed ash wood", count: 4, result_id: "Long ash wood shaft"},
        {material_id: "Processed mahogany wood", count: 4, result_id: "Long mahogany wood shaft"}
    ],
    item_type: "Component",
    recipe_skill: "Crafting",
});
	
	
})();

//shield components
(()=>{
    crafting_recipes.components["Shield base"] = new ComponentRecipe({
        name: "Shield base",
        materials: [
            {material_id: "Processed rough wood", count: 6, result_id: "Crude wooden shield base"}, 
            {material_id: "Processed wood", count: 6, result_id: "Wooden shield base"},
        ],
        item_type: "Component",
        recipe_skill: "Crafting",
        component_type: "shield base",
    });

    crafting_recipes.components["Shield handle"] = new ComponentRecipe({
        name: "Shield handle",
        materials: [
            {material_id: "Processed rough wood", count: 4, result_id: "Basic shield handle"}, 
            {material_id: "Processed wood", count: 4, result_id: "Wooden shield handle"},
        ],
        item_type: "Component",
        recipe_skill: "Crafting",
        component_type: "shield handle",
    });

    forging_recipes.components["Shield base"] = new ComponentRecipe({
        name: "Shield base",
        materials: [
            {material_id: "Low quality iron ingot", count: 5, result_id: "Crude iron shield base"},
            {material_id: "Iron ingot", count: 5, result_id: "Iron shield base"},
        ],
        item_type: "Component",
        recipe_skill: "Forging",
        component_type: "shield base",
    });

})();

//armor components
(()=>{
    crafting_recipes.components["Helmet exterior"] = new ComponentRecipe({
        name: "Helmet exterior",
        materials: [
            {material_id: "Piece of wolf leather", count: 3, result_id: "Wolf leather helmet armor"}, 
            {material_id: "Piece of boar leather", count: 3, result_id: "Boar leather helmet armor"},
        ],
        item_type: "Component",
        recipe_skill: "Crafting",
        component_type: "helmet exterior",
    });

    forging_recipes.components["Helmet exterior"] = new ComponentRecipe({
        name: "Helmet exterior",
        materials: [
            {material_id: "Iron chainmail", count: 3, result_id: "Iron chainmail helmet armor"},
        ],
        item_type: "Component",
        recipe_skill: "Forging",
        component_type: "helmet exterior",
    });
    
    crafting_recipes.components["Chestplate exterior"] = new ComponentRecipe({
        name: "Chestplate exterior",
        materials: [
            {material_id: "Piece of wolf leather", count: 5, result_id: "Wolf leather chestplate armor"}, 
            {material_id: "Piece of boar leather", count: 5, result_id: "Boar leather chestplate armor"},
        ],
        item_type: "Component",
        recipe_skill: "Crafting",
        component_type: "chestplate exterior",
    });

    forging_recipes.components["Chestplate exterior"] = new ComponentRecipe({
        name: "Chestplate exterior",
        materials: [
            {material_id: "Iron chainmail", count: 5, result_id: "Iron chainmail vest"},
        ],
        item_type: "Component",
        recipe_skill: "Forging",
        component_type: "chestplate exterior",
    });

    crafting_recipes.components["Leg armor exterior"] = new ComponentRecipe({
        name: "Leg armor exterior",
        materials: [
            {material_id: "Piece of wolf leather", count: 4, result_id: "Wolf leather greaves"}, 
            {material_id: "Piece of boar leather", count: 4, result_id: "Boar leather greaves"},
        ],
        item_type: "Component",
        recipe_skill: "Crafting",
        component_type: "leg armor exterior",
    });

    forging_recipes.components["Leg armor exterior"] = new ComponentRecipe({
        name: "Leg armor exterior",
        materials: [
            {material_id: "Iron chainmail", count: 4, result_id: "Iron chainmail greaves"},
        ],
        item_type: "Component",
        recipe_skill: "Forging",
        component_type: "leg armor exterior",
    });

    crafting_recipes.components["Glove exterior"] = new ComponentRecipe({
        name: "Glove exterior",
        materials: [
            {material_id: "Piece of wolf leather", count: 3, result_id: "Wolf leather glove armor"}, 
            {material_id: "Piece of boar leather", count: 3, result_id: "Boar leather glove armor"},
        ],
        item_type: "Component",
        recipe_skill: "Crafting",
        component_type: "glove exterior",
    });

    forging_recipes.components["Glove exterior"] = new ComponentRecipe({
        name: "Glove exterior",
        materials: [
            {material_id: "Iron chainmail", count: 3, result_id: "Iron chainmail glove"},
        ],
        item_type: "Component",
        recipe_skill: "Forging",
        component_type: "Glove exterior",
    });

    crafting_recipes.components["Shoes exterior"] = new ComponentRecipe({
        name: "Shoes exterior",
        materials: [
            {material_id: "Piece of wolf leather", count: 3, result_id: "Wolf leather shoe armor"}, 
            {material_id: "Piece of boar leather", count: 3, result_id: "Boar leather shoe armor"},
        ],
        item_type: "Component",
        recipe_skill: "Crafting",
        component_type: "shoes exterior",
    });

    forging_recipes.components["Shoes exterior"] = new ComponentRecipe({
        name: "Shoes exterior",
        materials: [
            {material_id: "Iron chainmail", count: 3, result_id: "Iron chainmail shoes"},
        ],
        item_type: "Component",
        recipe_skill: "Forging",
        component_type: "shoes exterior",
    });


})();

//equipment
(()=>{
    //full weapons
    crafting_recipes.equipment["Axe"] = new EquipmentRecipe({
        name: "Axe",
        components: ["axe head", "medium handle"],
        item_type: "Weapon",
    });
    crafting_recipes.equipment["Dagger"] = new EquipmentRecipe({
        name: "Dagger",
        components: ["short blade", "short handle"],
        item_type: "Weapon",
    });
    crafting_recipes.equipment["Hammer"] = new EquipmentRecipe({
        name: "Hammer",
        components: ["hammer head", "medium handle"],
        item_type: "Weapon",
    });
    crafting_recipes.equipment["Spear"] = new EquipmentRecipe({
        name: "Spear",
        components: ["short blade", "long handle"],
        item_type: "Weapon",
    });
    crafting_recipes.equipment["Sword"] = new EquipmentRecipe({
        name: "Sword",
        components: ["long blade", "short handle"],
        item_type: "Weapon",
    });

    //full shields
    crafting_recipes.equipment["Shield"] = new EquipmentRecipe({
        name: "Shield",
        components: ["shield base","shield handle"],
        item_type: "Shield",
    })

    //full armor
    crafting_recipes.equipment["Helmet"] = new EquipmentRecipe({
        name: "Helmet",
        components: ["helmet interior", "helmet exterior"],
        item_type: "Armor",
    });
    crafting_recipes.equipment["Chestplate"] = new EquipmentRecipe({
        name: "Chestplate",
        components: ["chestplate interior", "chestplate exterior"],
        item_type: "Armor",
    });
    crafting_recipes.equipment["Leg armor"] = new EquipmentRecipe({
        name: "Leg armor",
        components: ["leg armor interior", "leg armor exterior"],
        item_type: "Armor",
    });
    crafting_recipes.equipment["Gauntlets"] = new EquipmentRecipe({
        name: "Gauntlets",
        components: ["glove interior", "glove exterior"],
        item_type: "Armor",
    });
    crafting_recipes.equipment["Armored shoes"] = new EquipmentRecipe({
        name: "Armored shoes",
        components: ["shoes interior", "shoes exterior"],
        item_type: "Armor",
    });
})();
    
//clothes (which is also equipment, but shhhh)
(()=>{
    crafting_recipes.equipment["Hat"] = new ComponentRecipe({
        name: "Hat",
        materials: [
            {material_id: "Piece of wolf leather", count: 3, result_id: "Leather hat"},
            {material_id: "Wool cloth", count: 3, result_id: "Wool hat"}
        ],
        item_type: "Armor",
        component_type: "helmet interior",
        recipe_skill: "Crafting",
    });

    crafting_recipes.equipment["Shirt"] = new ComponentRecipe({
        name: "Shirt",
        materials: [
            {material_id: "Piece of wolf rat leather", count: 5, result_id: "Cheap leather vest"},
            {material_id: "Piece of wolf leather", count: 5, result_id: "Leather vest"},
            {material_id: "Wool cloth", count: 5, result_id: "Wool shirt"}
        ],
        item_type: "Armor",
        component_type: "chestplate interior",
        recipe_skill: "Crafting",
    });

    crafting_recipes.equipment["Pants"] = new ComponentRecipe({
        name: "Pants",
        materials: [
            {material_id: "Piece of wolf rat leather", count: 3, result_id: "Cheap leather pants"},
            {material_id: "Piece of wolf leather", count: 3, result_id: "Leather pants"},
            {material_id: "Wool cloth", count: 3, result_id: "Wool pants"}
        ],
        item_type: "Armor",
        component_type: "leg armor interior",
        recipe_skill: "Crafting",
    });

    crafting_recipes.equipment["Gloves"] = new ComponentRecipe({
        name: "Gloves",
        materials: [
            {material_id: "Piece of wolf leather", count: 2, result_id: "Leather gloves"},
            {material_id: "Wool cloth", count: 2, result_id: "Wool gloves"}
        ],
        item_type: "Armor",
        component_type: "glove interior",
        recipe_skill: "Crafting",
    });

    crafting_recipes.equipment["Shoes"] = new ComponentRecipe({
        name: "Shoes",
        materials: [
            {material_id: "Piece of wolf rat leather", count: 2, result_id: "Cheap leather shoes"},
            {material_id: "Piece of wolf leather", count: 2, result_id: "Leather shoes"}
        ],
        item_type: "Armor",
        component_type: "shoes interior",
        recipe_skill: "Crafting",
    });
    
})();

//materials
(function(){
    crafting_recipes.items["Piece of wolf rat leather"] = new ItemRecipe({
        name: "Piece of wolf rat leather",
        recipe_type: "material",
        materials: [{material_id: "Rat pelt", count: 8}], 
        result: {result_id: "Piece of wolf rat leather", count: 1},
        success_chance: [0.4,1],
        recipe_level: [1,5],
        recipe_skill: "Crafting",
    });
    crafting_recipes.items["Piece of wolf leather"] = new ItemRecipe({
        name: "Piece of wolf leather",
        recipe_type: "material",
        materials: [{material_id: "Wolf pelt", count: 8}], 
        result: {result_id: "Piece of wolf leather", count: 1},
        success_chance: [0.2,1],
        recipe_skill: "Crafting",
        recipe_level: [1,10],
    });
    crafting_recipes.items["Piece of boar leather"] = new ItemRecipe({
        name: "Piece of boar leather",
        recipe_type: "material",
        materials: [{material_id: "Boar hide", count: 8}],
        result: {result_id: "Piece of boar leather", count: 1},
        success_chance: [0.2,1],
        recipe_skill: "Crafting",
        recipe_level: [5,15],
    });
    crafting_recipes.items["Wool cloth"] = new ItemRecipe({
        name: "Wool cloth",
        recipe_type: "material",
        materials: [{material_id: "Wool", count: 5}], 
        result: {result_id: "Wool cloth", count: 1},
        success_chance: [0,1],
        recipe_skill: "Crafting",
        recipe_level: [5,15],
    });
    forging_recipes.items["Iron chainmail"] = new ItemRecipe({
        name: "Iron chainmail",
        recipe_type: "material",
        materials: [{material_id: "Iron ingot", count: 5}], 
        result: {result_id: "Iron chainmail", count: 1},
        success_chance: [0.1,1],
        recipe_skill: "Forging",
        recipe_level: [5,15],
    });

    crafting_recipes.items["Rat meat chunks"] = new ItemRecipe({
        name: "Rat meat chunks",
        recipe_type: "material",
        materials: [{material_id: "Rat tail", count: 8}], 
        result: {result_id: "Rat meat chunks", count: 1},
        success_chance: [0.4,1],
        recipe_level: [1,5],
        recipe_skill: "Crafting",
    });

    smelting_recipes.items["Low quality iron ingot"] = new ItemRecipe({
        name: "Low quality iron ingot",
        recipe_type: "material",
        materials: [{material_id: "Low quality iron ore", count: 5}], 
        result: {result_id: "Low quality iron ingot", count: 1},
        success_chance: [0.4,1],
        recipe_level: [1,5],
        recipe_skill: "Smelting",
    });
    smelting_recipes.items["Iron ingot"] = new ItemRecipe({
        name: "Iron ingot",
        recipe_type: "material",
        materials: [{material_id: "Iron ore", count: 5}], 
        result: {result_id: "Iron ingot", count: 1},
        success_chance: [0.1,1],
        recipe_level: [5,15],
        recipe_skill: "Smelting",
    });
    smelting_recipes.items["Blacksteel ingot"] = new ItemRecipe({
        name: "Blacksteel ingot",
        recipe_type: "material",
        materials: [{material_id: "Blacksteel ore", count: 5}], 
        result: {result_id: "Blacksteel ingot", count: 1},
        success_chance: [0.1,1],
        recipe_level: [10,20],
        recipe_skill: "Smelting",
    });
    smelting_recipes.items["Mithril ingot"] = new ItemRecipe({
        name: "Mithril ingot",
        recipe_type: "material",
        materials: [{material_id: "Mithril ore", count: 5}], 
        result: {result_id: "Mithril ingot", count: 1},
        success_chance: [0.1,1],
        recipe_level: [15,25],
        recipe_skill: "Smelting",
    });	

    crafting_recipes.items["Processed rough wood"] = new ItemRecipe({
        name: "Processed rough wood",
        recipe_type: "material",
        materials: [{material_id: "Piece of rough wood", count: 5}], 
        result: {result_id: "Processed rough wood", count: 1},
        success_chance: [0.6,1],
        recipe_level: [1,5],
        recipe_skill: "Crafting",
    });
    crafting_recipes.items["Processed wood"] = new ItemRecipe({
        name: "Processed wood",
        recipe_type: "material",
        materials: [{material_id: "Piece of wood", count: 5}], 
        result: {result_id: "Processed wood", count: 1},
        success_chance: [0.2,1],
        recipe_level: [5,15],
        recipe_skill: "Crafting",
    });
    crafting_recipes.items["Processed ash wood"] = new ItemRecipe({
        name: "Processed ash wood",
        recipe_type: "material",
        materials: [{material_id: "Piece of ash wood", count: 5}], 
        result: {result_id: "Processed ash wood", count: 1},
        success_chance: [0.2,1],
        recipe_level: [10,20],
        recipe_skill: "Crafting",
    });
    crafting_recipes.items["Processed mahogany wood"] = new ItemRecipe({
        name: "Processed mahogany wood",
        recipe_type: "material",
        materials: [{material_id: "Piece of mahogany wood", count: 5}], 
        result: {result_id: "Processed mahogany wood", count: 1},
        success_chance: [0.2,1],
        recipe_level: [15,25],
        recipe_skill: "Crafting",
    });	
})();

//consumables
(function(){
	    cooking_recipes.items["Grilled goo"] = new ItemRecipe({
        name: "Grilled goo",
        recipe_type: "usable",
        materials: [{material_id: "Goo", count: 2}], 
        result: {result_id: "Grilled goo", count: 1},
        success_chance: [0.7,1],
        recipe_level: [1,1],
        recipe_skill: "Cooking",
    });
    cooking_recipes.items["Roasted rat meat"] = new ItemRecipe({
        name: "Roasted rat meat",
        recipe_type: "usable",
        materials: [{material_id: "Rat meat chunks", count: 2}], 
        result: {result_id: "Roasted rat meat", count: 1},
        success_chance: [0.4,1],
        recipe_level: [1,5],
        recipe_skill: "Cooking",
    });
    cooking_recipes.items["Roasted purified rat meat"] = new ItemRecipe({
        name: "Roasted purified rat meat",
        recipe_type: "usable",
        materials: [{material_id: "Rat meat chunks", count: 2},
                    {material_id: "Belmart leaf", count: 1},
        ],
        result: {result_id: "Roasted purified rat meat", count: 1},
        success_chance: [0.4,1],
        recipe_level: [1,10],
        recipe_skill: "Cooking",
    });
    alchemy_recipes.items["Weak healing powder"] = new ItemRecipe({
        name: "Weak healing powder",
        recipe_type: "usable",
        materials: [{material_id: "Golmoon leaf", count: 5}],
        result: {result_id: "Weak healing powder", count: 1},
        success_chance: [0.5,1],
        recipe_level: [1,10],
        recipe_skill: "Alchemy",
    });
    alchemy_recipes.items["Oneberry juice"] = new ItemRecipe({
        name: "Oneberry juice",
        recipe_type: "usable",
        materials: [{material_id: "Oneberry", count: 10},
                    {material_id: "Glass phial", count: 1},
        ],
        result: {result_id: "Oneberry juice", count: 1},
        success_chance: [0.4,1],
        recipe_level: [1,10],
        recipe_skill: "Alchemy",
    });
    cooking_recipes.items["Cooked Minnow"] = new ItemRecipe({
        name: "Cooked Minnow",
        recipe_type: "usable",
        materials: [{material_id: "Meagre Minnow", count: 2}], 
        result: {result_id: "Cooked Minnow", count: 1},
        success_chance: [0.4,1],
        recipe_level: [1,5],
        recipe_skill: "Cooking",
    });
	    cooking_recipes.items["Cooked Sardine"] = new ItemRecipe({
        name: "Cooked Sardine",
        recipe_type: "usable",
        materials: [{material_id: "Salty Sardine", count: 2}], 
        result: {result_id: "Cooked Sardine", count: 1},
        success_chance: [0.2,1],
        recipe_level: [4,8],
        recipe_skill: "Cooking",
    });
	    cooking_recipes.items["Cooked Goldfish"] = new ItemRecipe({
        name: "Cooked Goldfish",
        recipe_type: "usable",
        materials: [{material_id: "Glimmering Goldfish", count: 2}], 
        result: {result_id: "Cooked Goldfish", count: 1},
        success_chance: [0.1,1],
        recipe_level: [7,11],
        recipe_skill: "Cooking",
    });
	    cooking_recipes.items["Cooked Plaice"] = new ItemRecipe({
        name: "Cooked Plaice",
        recipe_type: "usable",
        materials: [{material_id: "Perfect Plaice", count: 2}], 
        result: {result_id: "Cooked Plaice", count: 1},
        success_chance: [0,1],
        recipe_level: [10,14],
        recipe_skill: "Cooking",
    });
	    cooking_recipes.items["Cooked Bass"] = new ItemRecipe({
        name: "Cooked Bass",
        recipe_type: "usable",
        materials: [{material_id: "Boisterous Bass", count: 2}], 
        result: {result_id: "Cooked Bass", count: 1},
        success_chance: [0,1],
        recipe_level: [13,17],
        recipe_skill: "Cooking",
    });
	    cooking_recipes.items["Cooked Crab"] = new ItemRecipe({
        name: "Cooked Crab",
        recipe_type: "usable",
        materials: [{material_id: "Clingy Crab", count: 2}], 
        result: {result_id: "Cooked Crab", count: 1},
        success_chance: [0,1],
        recipe_level: [16,20],
        recipe_skill: "Cooking",
    });
	    cooking_recipes.items["Cooked Haddock"] = new ItemRecipe({
        name: "Cooked Haddock",
        recipe_type: "usable",
        materials: [{material_id: "Haughty Haddock", count: 2}], 
        result: {result_id: "Cooked Haddock", count: 1},
        success_chance: [0,1],
        recipe_level: [19,23],
        recipe_skill: "Cooking",
    });
	    cooking_recipes.items["Cooked Carp"] = new ItemRecipe({
        name: "Cooked Carp",
        recipe_type: "usable",
        materials: [{material_id: "Cunning Carp", count: 2}], 
        result: {result_id: "Cooked Carp", count: 1},
        success_chance: [0,1],
        recipe_level: [22,26],
        recipe_skill: "Cooking",
    });
	    cooking_recipes.items["Cooked Tuna"] = new ItemRecipe({
        name: "Cooked Tuna",
        recipe_type: "usable",
        materials: [{material_id: "Timid Tuna", count: 2}], 
        result: {result_id: "Cooked Tuna", count: 1},
        success_chance: [0,1],
        recipe_level: [25,29],
        recipe_skill: "Cooking",
    });
	    cooking_recipes.items["Cooked Catfish"] = new ItemRecipe({
        name: "Cooked Catfish",
        recipe_type: "usable",
        materials: [{material_id: "Curious Catfish", count: 2}], 
        result: {result_id: "Cooked Catfish", count: 1},
        success_chance: [0,1],
        recipe_level: [28,32],
        recipe_skill: "Cooking",
    });

//instant heal items
alchemy_recipes.items["Minor Healing Salve"] = new ItemRecipe({
    name: "Minor Healing Salve",
    recipe_type: "usable",
    materials: [
        {material_id: "Golmoon leaf", count: 2},
        {material_id: "Belmart leaf", count: 1}
    ],
    result: {result_id: "Minor Healing Salve", count: 1},
    success_chance: [0.5, 1],
    recipe_level: [1, 5],
    recipe_skill: "Alchemy",
});

alchemy_recipes.items["Standard Healing Potion"] = new ItemRecipe({
    name: "Standard Healing Potion",
    recipe_type: "usable",
    materials: [
        {material_id: "Oneberry", count: 3},
        {material_id: "Golmoon leaf", count: 2},
        {material_id: "Bloodnettle", count: 2}
    ],
    result: {result_id: "Standard Healing Potion", count: 1},
    success_chance: [0.4, 1],
    recipe_level: [4, 10],
    recipe_skill: "Alchemy",
});

alchemy_recipes.items["Major Healing Elixir"] = new ItemRecipe({
    name: "Major Healing Elixir",
    recipe_type: "usable",
    materials: [
        {material_id: "Oneberry", count: 5},
        {material_id: "Bloodnettle", count: 5},
        {material_id: "Veindust", count: 3}
    ],
    result: {result_id: "Major Healing Elixir", count: 1},
    success_chance: [0.4, 1],
    recipe_level: [8, 16],
    recipe_skill: "Alchemy",
});
//status healing items

alchemy_recipes.items["Antidote"] = new ItemRecipe({
    name: "Antidote",
    recipe_type: "usable",
    materials: [
        {material_id: "Duskrill", count: 1},
        {material_id: "Glowcap", count: 1},
        {material_id: "Starshade", count: 1}
    ],
    result: {result_id: "Antidote", count: 1},
    success_chance: [0.3, 1],
    recipe_level: [5, 15],
    recipe_skill: "Alchemy",
});

alchemy_recipes.items["Burn Ointment"] = new ItemRecipe({
    name: "Burn Ointment",
    recipe_type: "usable",
    materials: [
        {material_id: "Cinderpetal", count: 1},
        {material_id: "Ashroot", count: 1},
        {material_id: "Belmart leaf", count: 1}
    ],
    result: {result_id: "Burn Ointment", count: 1},
    success_chance: [0.3, 1],
    recipe_level: [5, 15],
    recipe_skill: "Alchemy",
});

alchemy_recipes.items["Cryogel"] = new ItemRecipe({
    name: "Cryogel",
    recipe_type: "usable",
    materials: [
        {material_id: "Cryoroot", count: 1},
        {material_id: "Winterbloom", count: 1},
        {material_id: "Starshade", count: 1}
    ],
    result: {result_id: "Cryogel", count: 1},
    success_chance: [0.3, 1],
    recipe_level: [5, 15],
    recipe_skill: "Alchemy",
});

alchemy_recipes.items["Focus Salts"] = new ItemRecipe({
    name: "Focus Salts",
    recipe_type: "usable",
    materials: [
        {material_id: "Veindust", count: 1},
        {material_id: "Duskrill", count: 1},
        {material_id: "Starshade", count: 1}
    ],
    result: {result_id: "Focus Salts", count: 1},
    success_chance: [0.3, 1],
    recipe_level: [5, 15],
    recipe_skill: "Alchemy",
});

alchemy_recipes.items["Panacea"] = new ItemRecipe({
    name: "Panacea",
    recipe_type: "usable",
    materials: [
        {material_id: "Oneberry", count: 1},
        {material_id: "Golmoon leaf", count: 1},
        {material_id: "Glowcap", count: 1},
        {material_id: "Veindust", count: 1},
        {material_id: "Duskrill", count: 1},
        {material_id: "Sunberry", count: 1},
        {material_id: "Cryoroot", count: 1},
        {material_id: "Ashroot", count: 1},
        {material_id: "Winterbloom", count: 1}
    ],
    result: {result_id: "Panacea", count: 1},
    success_chance: [0.1, 1],
    recipe_level: [8, 18],
    recipe_skill: "Alchemy",
});

//status immunity items

alchemy_recipes.items["Venom Ward"] = new ItemRecipe({
    name: "Venom Ward",
    recipe_type: "usable",
    materials: [
        {material_id: "Glowcap", count: 6},
        {material_id: "Duskrill", count: 6},
        {material_id: "Starshade", count: 6}
    ],
    result: {result_id: "Venom Ward", count: 1},
    success_chance: [0.2, 1],
    recipe_level: [10, 20],
    recipe_skill: "Alchemy",
});

alchemy_recipes.items["Fireproof Draught"] = new ItemRecipe({
    name: "Fireproof Draught",
    recipe_type: "usable",
    materials: [
        {material_id: "Cinderpetal", count: 6},
        {material_id: "Ashroot", count: 6},
        {material_id: "Flamevine", count: 6}
    ],
    result: {result_id: "Fireproof Draught", count: 1},
    success_chance: [0.2, 1],
    recipe_level: [10, 20],
    recipe_skill: "Alchemy",
});

alchemy_recipes.items["Cryo Coating"] = new ItemRecipe({
    name: "Cryo Coating",
    recipe_type: "usable",
    materials: [
        {material_id: "Cryoroot", count: 6},
        {material_id: "Winterbloom", count: 6},
        {material_id: "Frostleaf", count: 6}
    ],
    result: {result_id: "Cryo Coating", count: 1},
    success_chance: [0.2, 1],
    recipe_level: [10, 20],
    recipe_skill: "Alchemy",
});

alchemy_recipes.items["Shockguard Brew"] = new ItemRecipe({
    name: "Shockguard Brew",
    recipe_type: "usable",
    materials: [
        {material_id: "Veindust", count: 6},
        {material_id: "Duskrill", count: 6},
        {material_id: "Starshade", count: 6}
    ],
    result: {result_id: "Shockguard Brew", count: 1},
    success_chance: [0.2, 1],
    recipe_level: [10, 20],
    recipe_skill: "Alchemy",
});

//elixirs

function make_elixir_recipe(name, result_id, materials, count_each = 25) {
    return new ItemRecipe({
        name,
        recipe_type: "usable",
        materials: materials.map(id => ({material_id: id, count: count_each})),
        result: {result_id, count: 1},
        success_chance: [0.0, 1],
        recipe_level: [25, 30],
        recipe_skill: "Alchemy",
    });
}

alchemy_recipes.items["Elixir of Strength"] = make_elixir_recipe(
    "Elixir of Strength", "Elixir of Strength",
    ["Bloodnettle", "Veindust", "Sunberry", "Glowcap"]
);

alchemy_recipes.items["Elixir of Dexterity"] = make_elixir_recipe(
    "Elixir of Dexterity", "Elixir of Dexterity",
    ["Duskrill", "Sunberry", "Golmoon leaf", "Bloodnettle"]
);

alchemy_recipes.items["Elixir of Agility"] = make_elixir_recipe(
    "Elixir of Agility", "Elixir of Agility",
    ["Starshade", "Sunberry", "Oneberry", "Duskrill"]
);

alchemy_recipes.items["Elixir of Intuition"] = make_elixir_recipe(
    "Elixir of Intuition", "Elixir of Intuition",
    ["Veindust", "Glowcap", "Duskrill", "Winterbloom"]
);

alchemy_recipes.items["Elixir of Magic"] = make_elixir_recipe(
    "Elixir of Magic", "Elixir of Magic",
    ["Veindust", "Glowcap", "Duskrill", "Ashroot"]
);
	
	
})();

//trinkets
(function(){
    crafting_recipes.items["Wolf trophy"] = new ItemRecipe({
        name: "Wolf trophy",
        id: "Wolf trophy",
        recipe_type: "equipment",
        materials: [{material_id: "High quality wolf fang", count: 5}],
        result: {result_id: "Wolf trophy", count: 1},
        success_chance: [0.5,1],
        recipe_level: [1,10],
        recipe_skill: "Crafting",
    });
    crafting_recipes.items["Boar trophy"] = new ItemRecipe({
        name: "Boar trophy",
        id: "Boar trophy",
        recipe_type: "equipment",
        materials: [{material_id: "High quality boar tusk", count: 5}],
        result: {result_id: "Boar trophy", count: 1},
        success_chance: [0.5,1],
        recipe_level: [5,15],
        recipe_skill: "Crafting",
    });
})();

const recipes = {
    crafting: crafting_recipes, 
    cooking: cooking_recipes, 
    smelting: smelting_recipes, 
    forging: forging_recipes, 
    alchemy: alchemy_recipes
}

export {recipes, get_recipe_xp_value}
