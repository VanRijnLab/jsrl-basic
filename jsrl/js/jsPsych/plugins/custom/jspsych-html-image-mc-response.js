/**
 * jspsych-html-image-mc-response
 * Maarten van der Velde
 *
 * Plugin for displaying an image and multiple-choice answer options.
 * Based on the jspsych-html-keyboard-response plugin.
 * 
 *
 **/


jsPsych.plugins["html-image-mc-response"] = (function () {

    var plugin = {};

    plugin.info = {
        name: "html-image-mc-response",
        parameters: {
            question: {
                type: jsPsych.plugins.parameterType.OBJECT,
                pretty_name: 'Question',
                default: null,
                description: 'Question object'
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
            button_html: {
                type: jsPsych.plugins.parameterType.STRING,
                pretty_name: 'Button HTML',
                default: '<button class="jspsych-btn">%choice%</button>',
                array: true,
                description: 'The html of the button. Can create own style.'
            },
            margin_vertical: {
                type: jsPsych.plugins.parameterType.STRING,
                pretty_name: 'Margin vertical',
                default: '8px',
                description: 'The vertical margin of the button.'
            },
            margin_horizontal: {
                type: jsPsych.plugins.parameterType.STRING,
                pretty_name: 'Margin horizontal',
                default: '8px',
                description: 'The horizontal margin of the button.'
            }
        }
    };


    plugin.trial = function (display_element, trial) {
        
        var response = null;
        var correct = null;
        var rt = Infinity;
        var response_time_out;
        var timed_out = false;

        var new_html = '';

        // show the prompt
        if (trial.prompt !== null) {
            new_html += '<p>' + trial.prompt + '<p>';
        }

        new_html += '<div id="jspsych-html-image-mc-response-stimulus">';

        // show the stimulus
        if (typeof trial.question.image !== 'undefined' && trial.question.image.length > 0) {
            new_html += '<img src="' + trial.question.image + '" id="rl-image"></img>';
        } else {
            console.error("Missing image.")
        }

        new_html += '</div><div></div>';

        // show the answer if it's a study trial
        hint = '<p id="jspsych-html-image-mc-response-hint"></br></p>';
        if (trial.question.study) {
            hint = '<p id="jspsych-html-image-mc-response-hint">' + trial.question.answer + '</p>';
        }

        new_html += hint;

        // add answer buttons
        var buttons = [];

        for (var i = 0; i < trial.question.choices.length; i++) {
            buttons.push(trial.button_html);
        }

        new_html += '<div id="jspsych-image-button-response-btngroup">';

        for (var i = 0; i < trial.question.choices.length; i++) {
            var str = buttons[i].replace(/%choice%/g, trial.question.choices[i]);
            new_html += '<div class="jspsych-image-button-response-button" style="display: block; margin:' + trial.margin_vertical + ' ' + trial.margin_horizontal + '" id="jspsych-image-button-response-button-' + i + '" data-choice="' + i + '">' + str + '</div>';
        }
        new_html += '</div>';

        // draw
        display_element.innerHTML = new_html;

        // record start time
        var presentation_start_time = Date.now();

        // listen for button press
        for (var i = 0; i < trial.question.choices.length; i++) {
            display_element.querySelector('#jspsych-image-button-response-button-' + i).addEventListener('click', function (e) {
                var choice = trial.question.choices[e.currentTarget.getAttribute('data-choice')];
                rt = Date.now() - presentation_start_time;
                after_response(
                    {
                        choice: choice,
                        rt: rt
                    }
                );
            });
        }

        // show feedback about the final response to the participant
        var show_feedback = function () {
            if (typeof response_time_out !== "undefined") {
                clearTimeout(response_time_out);
            }

            // Highlight the correct answer in green
            correct_index = trial.question.choices.indexOf(trial.question.answer);

            var btns = document.querySelectorAll('.jspsych-image-button-response-button button');

            btns[correct_index].classList.add("correct-answer");

            // If the reponse was incorrect, highlight the incorrect response in red
            if(correct === false) {
                incorrect_index = trial.question.choices.indexOf(response);

                btns[incorrect_index].classList.add("wrong-answer");
            }

            feedback_duration = correct ? trial.correct_feedback_duration : trial.incorrect_feedback_duration;
            jsPsych.pluginAPI.setTimeout(end_trial, feedback_duration);

        }

        // End trial without feedback
        var continue_without_feedback = function () {
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

            // gather the data to store for the trial
            var trial_data = {
                "presentation_start_time": presentation_start_time,
                "id": trial.question.id,
                "text": trial.question.text,
                "image": trial.question.image,
                "response": response,
                "rt": rt,
                "answer": trial.question.answer,
                "choices": trial.question.choices,
                "correct": correct,
                "study": trial.question.study
            };

            // clear the display
            display_element.innerHTML = '';

            // move on to the next trial
            jsPsych.finishTrial(trial_data);
        };


        // function to handle responses by the subject
        var after_response = function (info) {

            response = info.choice;

            // after a valid response, the stimulus will have the CSS class 'responded'
            // which can be used to provide visual feedback that a response was recorded
            display_element.querySelector('#jspsych-html-image-mc-response-stimulus').className += ' responded';

            // disable all the buttons after a response
            var btns = document.querySelectorAll('.jspsych-image-button-response-button button');
            for (var i = 0; i < btns.length; i++) {
                btns[i].setAttribute('disabled', 'disabled');
            }


            correct = response === trial.question.answer;

            prepare_feedback();

        };


        // hide stimulus if stimulus_duration is set
        if (trial.stimulus_duration !== null) {
            jsPsych.pluginAPI.setTimeout(function () {
                display_element.querySelector('#jspsych-html-image-mc-response-stimulus').style.visibility = 'hidden';
            }, trial.stimulus_duration);
        }

        // end trial if trial_duration is set
        if (trial.trial_duration !== null) {
            response_time_out = jsPsych.pluginAPI.setTimeout(function () {
                timed_out = true;
                responses.push({
                    response: null,
                    rt: Infinity,
                });
                prepare_feedback();
            }, trial.trial_duration);
        }

    };

    return plugin;
})();
