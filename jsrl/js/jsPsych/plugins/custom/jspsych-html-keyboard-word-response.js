/**
 * jspsych-html-keyboard-word-response
 * Maarten van der Velde
 *
 * Plugin for displaying a stimulus and getting the full sequence of characters in the keyboard response.
 * Based on the jspsych-html-keyboard-response plugin.
 * 
 *
 **/


jsPsych.plugins["html-keyboard-word-response"] = (function () {

    var plugin = {};

    plugin.info = {
        name: "html-keyboard-word-response",
        parameters: {
            question: {
                type: jsPsych.plugins.parameterType.OBJECT,
                pretty_name: 'Question',
                default: null,
                description: 'Question object'
            },
            choices: {
                type: jsPsych.plugins.parameterType.KEYCODE,
                array: true,
                pretty_name: 'Choices',
                default: jsPsych.ALL_KEYS,
                description: 'The keys the subject is allowed to press to respond to the stimulus.'
            },
            prompt: {
                type: jsPsych.plugins.parameterType.STRING,
                pretty_name: 'Prompt',
                default: null,
                description: 'Any content here will be displayed above the stimulus.'
            },
            stimulus_duration: {
                type: jsPsych.plugins.parameterType.INT,
                pretty_name: 'Stimulus duration',
                default: null,
                description: 'How long to hide the stimulus.'
            },
            trial_duration: {
                type: jsPsych.plugins.parameterType.INT,
                pretty_name: 'Trial duration',
                default: null,
                description: 'How long to show trial before it ends.'
            },
            end_trial_key: {
                type: jsPsych.plugins.parameterType.KEYCODE,
                pretty_name: 'End trial key',
                default: 13, // ENTER key
                description: 'The key that finalises the response.'
            },
            show_feedback: {
                type: jsPsych.plugins.parameterType.BOOL,
                pretty_name: 'Show feedback',
                default: true,
                description: 'Show feedback after an answer is given.'
            },
            correct_feedback_duration: {
                type: jsPsych.plugins.parameterType.INT,
                pretty_name: 'Correct feedback duration',
                default: 200,
                description: 'The length of time in milliseconds to show the feedback when the answer is correct.'
            },
            almost_correct_feedback_duration: {
                type: jsPsych.plugins.parameterType.INT,
                pretty_name: 'Almost correct feedback duration',
                default: 200,
                description: 'The length of time in milliseconds to show the feedback when the answer is almost correct.'
            },
            incorrect_feedback_duration: {
                type: jsPsych.plugins.parameterType.INT,
                pretty_name: 'Incorrect feedback duration',
                default: 200,
                description: 'The length of time in milliseconds to show the feedback when the answer is incorrect.'
            },
            require_capitalisation: {
                type: jsPsych.plugins.parameterType.BOOL,
                pretty_name: 'Require capitalisation',
                default: false,
                description: 'Require correct capitalisation of the answer.'
            },
            require_accents: {
                type: jsPsych.plugins.parameterType.BOOL,
                pretty_name: 'Require accents',
                default: false,
                description: 'Require correct accents and special characters in the answer.'
            },
            permissible_edit_distance: {
                type: jsPsych.plugins.parameterType.INT,
                pretty_name: 'Permissible edit distance',
                default: 0,
                description: 'The Damerau-Levenshtein distance from the correct answer at which a response is still considered correct.'
            }

        }
    };


    plugin.trial = function (display_element, trial) {
 
        var new_html = '';
        
        // show the prompt
        if (trial.prompt !== null) {
            new_html += '<p>' + trial.prompt + '<p>';
        }
        
        new_html += '<div id="jspsych-html-keyboard-word-response-stimulus">';

        // show the stimulus
        if (typeof trial.question.image !== 'undefined' && trial.question.image.length > 0) {
            new_html += '<img src="' + trial.question.image + '" id="rl-image"></img>';
        } else {
            new_html += trial.question.text;
        }

        new_html += '</div><div></div>';

        // show the answer if it's a study trial
        hint = '<p id="jspsych-html-voicekey-response-hint"></br></p>';
        if (trial.question.study) {
            hint = '<p id="jspsych-html-voicekey-response-hint">' + trial.question.answer + '</p>';
        }

        new_html += hint;

        // add text input
        new_html += '<input text id="jspsych-html-keyboard-word-response-answerInput" type="text" \
        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />'

        // add div for feedback
        new_html += '<div id="jspsych-html-keyboard-word-response-feedback"><p></br></p></div>'

        // draw
        display_element.innerHTML = new_html;

        // record start time
        var presentation_start_time = Date.now();

        // focus on text input
        display_element.querySelector("#jspsych-html-keyboard-word-response-answerInput").focus();

        // store all keypresses
        var responses = [];
        var final_response = "";
        var correct = null;
        var almost_correct = null;
        var backspace_used = false;
        var backspaced_first_letter = false;
        var response_time_out;
        var timed_out = false;

        // show feedback about the final response to the participant
        var show_feedback = function () {
            if (typeof response_time_out !== "undefined") {
                clearTimeout(response_time_out);
            }

            display_element.querySelector("#jspsych-html-keyboard-word-response-answerInput").disabled = true;
            display_element.querySelector("#jspsych-html-keyboard-word-response-answerInput").value = final_response;

            if (correct) {
                feedback = '<p>Correct!</p>';
            } else if (almost_correct) {
                feedback = '<p>Almost correct. Correct answer: <b>' + trial.question.answer + '</b></p>';
            } else if (timed_out) {
                feedback = '<p>Too slow. Correct answer: <b>' + trial.question.answer + '</b></p>';
            } else {
                feedback = '<p>Incorrect! Correct answer: <b>' + trial.question.answer + '</b></p>';
            }

            display_element.querySelector("#jspsych-html-keyboard-word-response-feedback").innerHTML = feedback;

            feedback_duration = correct ? trial.correct_feedback_duration : almost_correct ? trial.almost_correct_feedback_duration : trial.incorrect_feedback_duration;
            jsPsych.pluginAPI.setTimeout(end_trial, feedback_duration);

        }

        // End trial without feedback
        var continue_without_feedback = function () {
            display_element.querySelector("#jspsych-html-keyboard-word-response-answerInput").disabled = true;
            display_element.querySelector("#jspsych-html-keyboard-word-response-answerInput").value = final_response;

            jsPsych.pluginAPI.setTimeout(end_trial, 1000);

        }


        var prepare_feedback = function () {
            if (typeof response_time_out !== "undefined") {
                clearTimeout(response_time_out);
            }

            if (trial.show_feedback) {
                show_feedback();
            } else {
                continue_without_feedback();
            }
        }

        // function to end trial when it is time
        var end_trial = function () {

            // kill any remaining setTimeout handlers
            jsPsych.pluginAPI.clearAllTimeouts();

            // kill keyboard listeners
            if (typeof keyboardListener !== 'undefined') {
                jsPsych.pluginAPI.cancelKeyboardResponse(keyboardListener);
            }

            // gather the data to store for the trial
            var trial_data = {
                "presentation_start_time": presentation_start_time,
                "id": trial.question.id,
                "text": trial.question.text,
                "response": final_response,
                "rt": get_reaction_time(),
                "keypresses": JSON.stringify(responses),
                "answer": trial.question.answer,
                "correct": Boolean(correct | almost_correct),
                "study": trial.question.study,
                "backspace_used": backspace_used,
                "backspaced_first_letter": backspaced_first_letter
            };

            // clear the display
            display_element.innerHTML = '';

            // move on to the next trial
            jsPsych.finishTrial(trial_data);
        };

        var get_reaction_time = function () {
            return backspaced_first_letter ? Infinity : responses[0].rt;
        }

        var calculate_edit_distance = function (a, b) {
            if (!trial.require_capitalisation) {
                a = a.toLowerCase();
                b = b.toLowerCase();
            }
            if (!trial.require_accents) {
                a = a.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
                b = b.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
            }
            return damerau_levenshtein(a, b);
        }

        var damerau_levenshtein = function (a, b) {
            var i, j, cost;
            var d = [];

            if (a.length == 0) {
                return b.length;
            }

            if (b.length == 0) {
                return a.length;
            }

            for (i = 0; i <= a.length; i++) {
                d[i] = [];
                d[i][0] = i;
            }

            for (j = 0; j <= b.length; j++) {
                d[0][j] = j;
            }

            for (i = 1; i <= a.length; i++) {
                for (j = 1; j <= b.length; j++) {
                    if (a.charAt(i - 1) == b.charAt(j - 1)) {
                        cost = 0;
                    }
                    else {
                        cost = 1;
                    }

                    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);

                    if (i > 1 && j > 1 && a.charAt(i - 1) == b.charAt(j - 2) &&
                        a.charAt(i - 2) == b.charAt(j - 1)) {

                        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost)

                    }
                }
            }
            return d[a.length][b.length];
        }

        // function to handle responses by the subject
        var after_response = function (info) {

            pressed_key = jsPsych.pluginAPI.convertKeyCodeToKeyCharacter(info.key);

            responses.push({
                key_press: pressed_key,
                rt: info.rt,
            });

            // after a valid response, the stimulus will have the CSS class 'responded'
            // which can be used to provide visual feedback that a response was recorded
            display_element.querySelector('#jspsych-html-keyboard-word-response-stimulus').className += ' responded';

            // handle backspace key press
            if (info.key === 8) {
                backspace_used = true;

                // if the first letter is going to be erased, the RT is no longer useable
                if (display_element.querySelector('#jspsych-html-keyboard-word-response-answerInput').value.length <= 1) {
                    backspaced_first_letter = true;
                }
            }

            if (info.key === trial.end_trial_key) {
                final_response = display_element.querySelector('#jspsych-html-keyboard-word-response-answerInput').value;
                edit_distance = calculate_edit_distance(final_response, trial.question.answer);    
                if (edit_distance === 0) {
                    correct = true;
                } else if (edit_distance  <= trial.permissible_edit_distance) {
                    almost_correct = true;
                } else {
                    correct = false;
                }
                prepare_feedback();
            }
        };

        // start the response listener
        if (trial.choices != jsPsych.NO_KEYS) {
            var keyboardListener = jsPsych.pluginAPI.getKeyboardResponse({
                callback_function: after_response,
                valid_responses: trial.choices,
                persist: true,
                allow_held_key: true,
                prevent_default: false,
                rt_method: "performance"
            });
        }

        // hide stimulus if stimulus_duration is set
        if (trial.stimulus_duration !== null) {
            jsPsych.pluginAPI.setTimeout(function () {
                display_element.querySelector('#jspsych-html-keyboard-word-response-stimulus').style.visibility = 'hidden';
            }, trial.stimulus_duration);
        }

        // end trial if trial_duration is set
        if (trial.trial_duration !== null) {
            response_time_out = jsPsych.pluginAPI.setTimeout(function () {
                timed_out = true;
                responses.push({
                    key_press: null,
                    rt: Infinity,
                });
                prepare_feedback();
            }, trial.trial_duration);
        }

    };

    return plugin;
})();
