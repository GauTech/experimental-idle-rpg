const effect_templates = {};
//templates, since some effects will appear across multiple items but with different durations

class ActiveEffect {
    /**
     * @param {Object} effect_data
     * @param {String} effect_data.name
     * @param {String} [effect_data.id]
     * @param {Number} effect_data.duration
     * @param {Object} effect_data.effects
     * @param {String} [effect_data.type] // e.g., "foodbuff"
     * @param {Number} [effect_data.potency] // derived metric
     */
    constructor({ name, id, duration, effects, type = "misc", potency = null }) {
        this.name = name;
        this.id = id || name;
        this.duration = duration ?? 0;
        this.effects = effects;
        this.type = type;
        this.potency = potency !== null ? potency : this.calculatePotency();
    }

    calculatePotency() {
        let total = 0;
        if (this.effects?.stats) {
            for (const stat in this.effects.stats) {
                const val = this.effects.stats[stat]?.flat || 0;
                total += val;
            }
        }
        return total;
    }
}




effect_templates["Weak healing powder"] = new ActiveEffect({
    name: "Weak healing powder",
    effects: {
        stats: {
            health_regeneration_flat: {flat: 1},
        }
    }
});
effect_templates["Weak healing potion"] = new ActiveEffect({
    name: "Weak healing potion",
    effects: {
        stats: {
            health_regeneration_flat: {flat: 6},
            health_regeneration_percent: {percent: 1},
        }
    }
});

effect_templates["Basic meal"] = new ActiveEffect({
    name: "Basic meal",
    type: "foodbuff",
    effects: {
        stats: {
            stamina_regeneration_flat: { flat: 1 }
        }
    }
});

effect_templates["Cheap meat meal"] = new ActiveEffect({
    name: "Cheap meat meal",
    type: "foodbuff",
    effects: {
        stats: {
            stamina_regeneration_flat: { flat: 2 }
        }
    }
});

effect_templates["Cheap fish dish"] = new ActiveEffect({
    name: "Cheap fish dish",
    type: "foodbuff",
    effects: {
        stats: {
            stamina_regeneration_flat: { flat: 2 }
        }
    }
});

effect_templates["Simple fish dish"] = new ActiveEffect({
    name: "Simple fish dish",
    type: "foodbuff",
    effects: {
        stats: {
            stamina_regeneration_flat: { flat: 3 },
            health_regeneration_flat: { flat: 1 }
        }
    }
});

effect_templates["Ordinary fish dish"] = new ActiveEffect({
    name: "Ordinary fish dish",
    type: "foodbuff",
    effects: {
        stats: {
            stamina_regeneration_flat: { flat: 6 },
            health_regeneration_flat: { flat: 2 }
        }
    }
});

effect_templates["Superior fish dish"] = new ActiveEffect({
    name: "Superior fish dish",
    type: "foodbuff",
    effects: {
        stats: {
            stamina_regeneration_flat: { flat: 8 },
            health_regeneration_flat: { flat: 4 }
        }
    }
});

effect_templates["Luxury fish dish"] = new ActiveEffect({
    name: "Luxury fish dish",
    type: "foodbuff",
    effects: {
        stats: {
            stamina_regeneration_flat: { flat: 15 },
            health_regeneration_flat: { flat: 7 }
        }
    }
});



effect_templates["Slight food poisoning"] = new ActiveEffect({
    name: "Slight food poisoning",
    effects: {
        stats: {
            health_loss_flat: {flat: -0.5},
        }
    },
});

effect_templates["Minor strength boost"] = new ActiveEffect({
    name: "Minor strength boost",
    effects: {
        stats: {
            strength: {flat: 5},
        }
    }
});

effect_templates["Minor magic boost"] = new ActiveEffect({
    name: "Minor magic boost",
    effects: {
        stats: {
            magic: {flat: 5},
        }
    }
});

effect_templates["Minor defense boost"] = new ActiveEffect({
    name: "Minor defense boost",
    effects: {
        stats: {
            defense: {flat: 2},
        }
    }
});

effect_templates["Major strength boost"] = new ActiveEffect({
    name: "Major strength boost",
    effects: {
        stats: {
            strength: {flat: 20},
        }
    }
});

effect_templates["Major magic boost"] = new ActiveEffect({
    name: "Major magic boost",
    effects: {
        stats: {
            magic: {flat: 20},
        }
    }
});

effect_templates["Major defense boost"] = new ActiveEffect({
    name: "Major defense boost",
    effects: {
        stats: {
            defense: {flat: 8},
        }
    }
});

effect_templates["Burn immunity"] = new ActiveEffect({
    name: "Burn immunity",
    effects: {
        immunities: {
            burn: true
        }
    }
});

effect_templates["Freeze immunity"] = new ActiveEffect({
    name: "Freeze immunity",
    effects: {
        immunities: {
            freeze: true
        }
    }
});

effect_templates["Stun immunity"] = new ActiveEffect({
    name: "Stun immunity",
    effects: {
        immunities: {
            stun: true
        }
    }
});

effect_templates["Poison immunity"] = new ActiveEffect({
    name: "Poison immunity",
    effects: {
        immunities: {
            poison: true
        }
    }
});

export {effect_templates, ActiveEffect};