//-------------------//
//     RL model      //
//-------------------//

// Load facts from file and parse as a dictionary
var facts;

function load_facts(materials, shuffle_items = false, callback) {
    jQuery.get(materials, function (data) {
        facts = Papa.parse(data, {
            header: true,
            skipEmptyLines: "greedy"
        }).data;
        facts.forEach(fact => {
            if (typeof fact.mu !== "undefined") {
                fact.mu = Number(fact.mu);
            } else {
                fact.mu = default_alpha;
            }
        });
        if (shuffle_items) {
            facts = shuffle(facts);
        }
        if (callback) callback();
    });


}

var test_facts = [];
var responses = [];

function record_response(data) {
    responses.push(data);
}

function reset_model(callback) {
    facts = [];
    test_facts = [];
    responses = [];

    if (callback) callback();
}


function get_next_fact(current_time) {

    // Calculate fact activations 15 seconds in the future
    const fact_activations = facts.map(fact => {
        return {
            fact: fact,
            activation: calculate_activation(current_time + lookahead_time, fact, responses)
        };
    });

    let [seen_facts, not_seen_facts] = partition(fact_activations, has_seen);
    test_facts = seen_facts.map(a => a.fact); // Update list of facts to be tested

    // Prevent an immediate repetition of the same fact
    if (seen_facts.length > 2) {
        const last_response = responses[responses.length - 1];
        seen_facts = seen_facts.filter(f => last_response.id != f.fact.id);
    }

    if (not_seen_facts.length === 0 || seen_facts.some(has_forgotten)) {
        // Reinforce weakest forgotten fact
        const weakest_fact = min(seen_facts, fact => fact.activation);
        question = weakest_fact.fact;
        question.study = false; // Don't show the answer
    } else {
        // Present a new fact
        question = not_seen_facts[0].fact;
        question.study = true; // Show the answer
    }

    // Add answer choices for multiple-choice format
    question.choices = get_answer_options(question);

    return question;


    function has_forgotten(fact) {
        return fact.activation < forget_threshold;
    }

    function has_seen(fact) {
        return fact.activation > Number.NEGATIVE_INFINITY;
    }

}

function get_answer_options(fact, n = 4) {
    const correct_answer = fact.answer;
    var distractors = facts.filter(f => f.answer != correct_answer);
    var choices = shuffle(distractors).slice(0, n-1).map(f => f.answer);
    choices.push(correct_answer);
    return shuffle(choices);
}

function get_next_practised_fact() {
    var test_fact = test_facts.shift();
    test_fact.study = false;
    return test_fact;
}

function is_next_practised_fact() {
    return test_facts.length > 0;
}

function calculate_activation(time, fact, responses) {
    const encounters = [];
    const responses_for_fact = responses.filter(response => response.id == fact.id);
    let alpha = fact.mu;

    for (const response of responses_for_fact) {
        const activation = calculate_activation_from_encounters(encounters, response.presentation_start_time);
        encounters.push({
            activation: activation,
            time: response.presentation_start_time,
            reaction_time: normalise_reaction_time(response)
        });

        // Update alpha estimate and recalculate all decays
        alpha = estimate_alpha(encounters, activation, response, alpha, fact.mu);

        for (const encounter of encounters) {
            encounter.decay = calculate_decay(encounter.activation, alpha);
        }

    }
    return calculate_activation_from_encounters(encounters, time);
}

function estimate_alpha(encounters, activation, response, previous_alpha, mu) {
    if (encounters.length < 3) {
        return mu;
    }

    let a0 = -Infinity;
    let a1 = Infinity;
    const a_fit = previous_alpha;
    const reading_time = get_reading_time(response.text);
    const estimated_rt = estimate_reaction_time_from_activation(activation, reading_time);
    const est_diff = estimated_rt - normalise_reaction_time(response);

    if (est_diff < 0) {
        // Estimated RT was too short (estimated m too high), so actual decay was larger
        a0 = a_fit;
        a1 = a_fit + 0.05;
    }
    else {
        // Estimated RT was too long (estimated m too low), so actual decay was smaller
        a0 = a_fit - 0.05;
        a1 = a_fit;
    }

    // Binary search between previous fit and new alpha
    for (let j = 0; j < 6; ++j) {
        // adjust all decays to use the new alpha (easy since alpha is just an offset)
        const a0_diff = a0 - a_fit;
        const a1_diff = a1 - a_fit;
        const d_a0 = encounters.map(encounter => {
            return {
                activation: encounter.activation,
                decay: encounter.decay + a0_diff,
                rt: encounter.reaction_time,
                time: encounter.time
            };
        });
        const d_a1 = encounters.map(encounter => {
            return {
                activation: encounter.activation,
                decay: encounter.decay + a1_diff,
                rt: encounter.reaction_time,
                time: encounter.time
            };
        });

        // calculate the reaction times from activation and compare against observed reaction times
        const encounter_window = encounters.slice(Math.max(1, encounters.length - 5));
        const total_a0_error = calculate_predicted_reaction_time_error(encounter_window, d_a0, reading_time);
        const total_a1_error = calculate_predicted_reaction_time_error(encounter_window, d_a1, reading_time);

        // adjust the search area based on total error
        const ac = (a0 + a1) / 2;
        if (total_a0_error < total_a1_error) {
            a1 = ac; // search between a0 and ac
        } else {
            a0 = ac; // search between ac and a1
        }
    }

    // narrowed range, take average of the two values as the new alpha for this item
    return (a0 + a1) / 2;

}

function calculate_activation_from_encounters(encounters, time) {
    const sum = sum_with(encounters, encounter => {
        if (encounter.time < time) {
            // only include encounters seen before time
            return Math.pow((time - encounter.time) / 1000, -encounter.decay);
        } else {
            return 0;
        }
    });
    return Math.log(sum);
}

function calculate_decay(activation, alpha) {
    const c = 0.25;
    return c * Math.exp(activation) + alpha;
}

function calculate_predicted_reaction_time_error(test_set, decay_adjusted_encounters, reading_time) {
    return sum_with(test_set, (encounter) => {
        const m = calculate_activation_from_encounters(decay_adjusted_encounters, encounter.time - 100);
        const rt = estimate_reaction_time_from_activation(m, reading_time);
        return Math.abs(encounter.reaction_time - rt);
    });
}

function count_words(text) {
    return text.split(' ').length;
}

function count_characters(text) {
    return text.length;
}

function estimate_reaction_time_from_activation(activation, reading_time) {
    const F = 1.0;
    return (F * Math.exp(-activation) + (reading_time / 1000)) * 1000;
}

function get_max_reaction_time_for_fact(text) {
    const reading_time = get_reading_time(text);
    return 1.5 * estimate_reaction_time_from_activation(forget_threshold, reading_time)
}

function get_reading_time(text) {
    const word_count = count_words(text);
    if (word_count > 1) {
        const character_count = count_characters(text);
        return Math.max((-157.9 + character_count * 19.5), 300);
    } else {
        return 300;
    }
}

function min(list, minWith) {
    let min = list[0];
    for (const element of list) {
        if (minWith(element) < minWith(min)) {
            min = element;
        }
    }
    return min;
}

function normalise_reaction_time(response) {
    const reaction_time = response.correct ? response.rt : 60 * 1000;
    const max_reaction_time = get_max_reaction_time_for_fact(response.text);
    return reaction_time > max_reaction_time ? max_reaction_time : reaction_time;
}

function partition(list, partitionFunction) {
    const result = [[], []];
    for (const element of list) {
        result[partitionFunction(element) ? 0 : 1].push(element);
    }
    return result;
}

function sum_with(list, summer) {
    let sum = 0;
    for (const element of list) {
        sum += summer(element);
    }
    return sum;
}

function shuffle(array) {
    var current_index = array.length;
    var temp_val;
    var random_index;

    while (0 !== current_index) {

        random_index = Math.floor(Math.random() * current_index);
        current_index -= 1;

        temp_val = array[current_index];
        array[current_index] = array[random_index];
        array[random_index] = temp_val;
    }

    return array;
}
