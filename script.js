// --- CONFIGURATION ---
// IMPORTANT: Update this URL to the RAW link of the FOLDER containing your JSON files on GitHub.
// It should end with a trailing slash '/'.
const GITHUB_JSON_BASE_URL = 'https://raw.githubusercontent.com/ghiassabir/Quiz-with-json-data-loading-feature-fix-with-real-data/main/data/json/';
// The URL of your deployed Google Apps Script Web App.
const APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwAA7VRzbnJy4XMLJUMlS6X4aqUC2acuQQLbOL1VbV--m6sdXUJ17MswbI855eFTSxd/exec';

// --- DOM ELEMENT REFERENCES ---
const welcomeScreen = document.getElementById('welcomeScreen');
const quizArea = document.getElementById('quizArea');
const confirmationScreen = document.getElementById('confirmationScreen');
const startButton = document.getElementById('startButton');
const studentEmailInput = document.getElementById('studentEmail');
const quizTitle = document.getElementById('quizTitle');
const questionText = document.getElementById('questionText');
const questionImage = document.getElementById('questionImage');
const optionsContainer = document.getElementById('optionsContainer');
const prevButton = document.getElementById('prevButton');
const nextButton = document.getElementById('nextButton');
const submitButton = document.getElementById('submitButton');
const progressText = document.getElementById('progressText');
const progressBar = document.getElementById('progressBar');
const questionNavigator = document.getElementById('questionNavigator');
const markReviewBtn = document.getElementById('markReviewBtn');
const timerDisplay = document.getElementById('timer'); // Assuming this is your timer element from quiz.html

// --- STATE MANAGEMENT VARIABLES ---
let currentQuizQuestions = []; // Will hold questions for the current quiz
let studentAnswers = {}; // Stores { question_id: { answer: "...", timeSpent: 0.00 } }
let markedForReview = new Set(); // Stores question_ids marked for review
let currentQuestionIndex = 0;
let questionStartTime = 0;
let studentEmail = '';
let quizTotalTime = 0; // Example: 30 minutes * 60 seconds
let quizTimerInterval;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    if (startButton) {
        startButton.addEventListener('click', startQuiz);
    }
    const savedEmail = localStorage.getItem('satHubStudentEmail');
    if (savedEmail && studentEmailInput) {
        studentEmailInput.value = savedEmail;
    }

    // Attach other listeners if elements exist
    if (nextButton) nextButton.addEventListener('click', () => { recordAnswer(); jumpToQuestion(currentQuestionIndex + 1); });
    if (prevButton) prevButton.addEventListener('click', () => { recordAnswer(); jumpToQuestion(currentQuestionIndex - 1); });
    if (submitButton) submitButton.addEventListener('click', () => { recordAnswer(); submitQuizData(); }); // Changed to submitQuizData
    if (markReviewBtn) markReviewBtn.addEventListener('click', toggleMarkForReview);
});

function startQuizTimer(durationSeconds) {
    let timeLeft = durationSeconds;
    updateTimerDisplay(timeLeft);

    quizTimerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay(timeLeft);
        if (timeLeft <= 0) {
            clearInterval(quizTimerInterval);
            alert("Time's up!");
            recordAnswer(); // Record answer for the current question
            submitQuizData(); // Auto-submit
        }
    }, 1000);
}

function updateTimerDisplay(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (timerDisplay) { // Check if timerDisplay element exists
        timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }
}


function startQuiz() {
    studentEmail = studentEmailInput.value;
    if (!studentEmail || !studentEmail.includes('@')) {
        alert('Please enter a valid email address.');
        return;
    }
    localStorage.setItem('satHubStudentEmail', studentEmail);

    const urlParams = new URLSearchParams(window.location.search);
    let quizNameFromUrl = urlParams.get('quiz');

    if (!quizNameFromUrl) {
        // Fallback for testing if no quiz parameter is provided
        // You might want to remove this or make it more robust for production
        console.warn("No 'quiz' URL parameter found. Using 'DT-T0-RW-M1' as a default for testing.");
        quizNameFromUrl = "DT-T0-RW-M1"; // Default to the quiz name from your CSV
    }

    if (quizTitle) { // Check if quizTitle element exists
        quizTitle.textContent = quizNameFromUrl.replace(/_/g, ' ').replace(/-/g, ' '); // Make title more readable
    }
    loadQuestions(quizNameFromUrl);
}

function loadQuestions(quizName) {
    if (startButton) {
        startButton.textContent = "Loading...";
        startButton.disabled = true;
    }
    if(quizArea) quizArea.classList.add('hidden');


    const quizJsonUrl = `${GITHUB_JSON_BASE_URL}${quizName}.json`;
    console.log(`Fetching quiz data from: ${quizJsonUrl}`);

    fetch(quizJsonUrl)
        .then(response => {
            if (!response.ok) {
                // If file not found, or other HTTP error
                throw new Error(`HTTP error! status: ${response.status} while fetching ${quizJsonUrl}`);
            }
            return response.json();
        })
        .then(data => {
            if (!Array.isArray(data)) {
                 throw new Error(`Data loaded from ${quizJsonUrl} is not an array. Check JSON structure.`);
            }
            currentQuizQuestions = data;
            if (currentQuizQuestions.length > 0) {
                console.log(`Successfully loaded ${currentQuizQuestions.length} questions for quiz: ${quizName}`);
                if(welcomeScreen) welcomeScreen.classList.add('hidden');
                if(quizArea) quizArea.classList.remove('hidden');

                // Reset quiz state for the new quiz
                studentAnswers = {};
                markedForReview.clear();
                currentQuestionIndex = 0;
                questionStartTime = 0; // Will be set when first question renders

                // Determine total time for the quiz (example: 1 minute per question)
                // You might want a more sophisticated way to set this, e.g., from CSV/JSON or fixed per quiz type
                quizTotalTime = currentQuizQuestions.length * 60; // 1 minute per question
                if (quizTimerInterval) clearInterval(quizTimerInterval); // Clear any existing timer
                startQuizTimer(quizTotalTime);


                buildQuestionNavigator();
                renderQuestion();
            } else {
                throw new Error(`No questions found for quiz "${quizName}" or data array is empty in ${quizJsonUrl}`);
            }
        })
        .catch(error => {
            console.error("Error during loadQuestions:", error);
            alert(`Failed to load quiz: ${error.message}. Please check the console and the quiz name/file.`);
            if(welcomeScreen) welcomeScreen.classList.remove('hidden'); // Show welcome screen again
            if(quizArea) quizArea.classList.add('hidden');
            if (startButton) {
                startButton.textContent = "Start Quiz";
                startButton.disabled = false;
            }
        });
}

function renderQuestion() {
    if (!currentQuizQuestions || currentQuizQuestions.length === 0 || !questionText || !optionsContainer || !questionImage) {
        console.error("Cannot render question, essential DOM elements or question data missing.");
        return;
    }
    optionsContainer.innerHTML = ''; // Clear previous options
    questionImage.classList.add('hidden'); // Hide image by default

    const question = currentQuizQuestions[currentQuestionIndex];
    if (!question) {
        console.error(`Question data not found for index: ${currentQuestionIndex}`);
        return;
    }

    questionText.innerHTML = question.question_text || "Question text is missing."; // Use innerHTML for MathJax

    if (question.image_url) {
        questionImage.src = question.image_url;
        questionImage.classList.remove('hidden');
    } else {
        questionImage.src = ""; // Clear src if no image
    }

    ['a', 'b', 'c', 'd'].forEach(optKey => {
        const optionText = question[`option_${optKey}`];
        if (optionText !== undefined && optionText !== null) { // Check if option exists and is not null
            const optionElement = document.createElement('div');
            optionElement.className = 'answer-option p-4 rounded-lg'; // Ensure styling from your CSS is applied
            // Use innerHTML for MathJax rendering of options
            optionElement.innerHTML = `<label class="flex items-center cursor-pointer w-full"><input type="radio" name="answer" value="${optionText.replace(/"/g, '"')}" class="mr-3 shrink-0"><span>${optionText}</span></label>`;
            
            optionElement.addEventListener('click', (e) => {
                // Prevent click on label from re-triggering if input is already target
                if (e.target.tagName !== 'INPUT') {
                    const radio = optionElement.querySelector('input');
                    if (radio) radio.checked = true;
                }
                handleOptionSelection();
            });
            
            const questionId = question.question_id;
            if (studentAnswers[questionId] && studentAnswers[questionId].answer === optionText) {
                optionElement.classList.add('selected');
                const radioInput = optionElement.querySelector('input');
                if (radioInput) radioInput.checked = true;
            }
            optionsContainer.appendChild(optionElement);
        }
    });
    
    if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise([questionText, optionsContainer]) // Target specific elements
            .catch((err) => console.error('MathJax typeset error:', err));
    }

    updateUI();
    questionStartTime = Date.now();
}

function handleOptionSelection() {
    document.querySelectorAll('.answer-option').forEach(el => {
        el.classList.remove('selected');
        const radioInput = el.querySelector('input');
        if (radioInput && radioInput.checked) {
            el.classList.add('selected');
        }
    });
}

function updateUI() {
    updateNavigation();
    updateProgressBar();
    updateNavigator();
    updateMarkForReviewButton();
}

function buildQuestionNavigator() {
    if (!questionNavigator) return;
    questionNavigator.innerHTML = '';
    currentQuizQuestions.forEach((q, index) => {
        const btn = document.createElement('button');
        btn.textContent = index + 1;
        btn.className = 'question-nav-btn p-2 rounded'; // Ensure styling from your CSS
        btn.dataset.index = index;
        btn.onclick = () => jumpToQuestion(index);
        questionNavigator.appendChild(btn);
    });
}

function updateNavigator() {
    if (!questionNavigator) return;
    const buttons = questionNavigator.querySelectorAll('.question-nav-btn');
    buttons.forEach((btn, index) => {
        if (!currentQuizQuestions[index]) return; // Safety check
        const questionId = currentQuizQuestions[index].question_id;
        btn.classList.remove('current', 'answered', 'unanswered', 'marked');
        if (index === currentQuestionIndex) btn.classList.add('current');
        if (studentAnswers[questionId] && studentAnswers[questionId].answer) btn.classList.add('answered');
        else btn.classList.add('unanswered');
        if (markedForReview.has(questionId)) btn.classList.add('marked');
    });
}

function updateNavigation() {
    if (!prevButton || !nextButton || !submitButton) return;
    prevButton.disabled = currentQuestionIndex === 0;
    const isLastQuestion = currentQuestionIndex === currentQuizQuestions.length - 1;
    nextButton.classList.toggle('hidden', isLastQuestion);
    submitButton.classList.toggle('hidden', !isLastQuestion);
}

function updateProgressBar() {
    if (!progressBar || !progressText || currentQuizQuestions.length === 0) return;
    const progress = ((currentQuestionIndex + 1) / currentQuizQuestions.length) * 100;
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `Question ${currentQuestionIndex + 1} of ${currentQuizQuestions.length}`;
}

function toggleMarkForReview() {
    if (!currentQuizQuestions[currentQuestionIndex]) return;
    const questionId = currentQuizQuestions[currentQuestionIndex].question_id;
    if (markedForReview.has(questionId)) {
        markedForReview.delete(questionId);
    } else {
        markedForReview.add(questionId);
    }
    updateNavigator();
    updateMarkForReviewButton();
}

function updateMarkForReviewButton() {
    if (!markReviewBtn || !currentQuizQuestions[currentQuestionIndex]) return;
    const questionId = currentQuizQuestions[currentQuestionIndex].question_id;
    markReviewBtn.classList.toggle('active', markedForReview.has(questionId));
}

function recordAnswer() {
    if (!currentQuizQuestions[currentQuestionIndex]) return; // Ensure current question exists

    const questionId = currentQuizQuestions[currentQuestionIndex].question_id;
    const selectedOptionInput = optionsContainer.querySelector('input[name="answer"]:checked');
    const timeSpentOnThisQuestion = (Date.now() - questionStartTime) / 1000;

    let currentAnswerData = studentAnswers[questionId] || { answer: "NO_ANSWER", timeSpent: 0 };
    
    if (selectedOptionInput) {
        currentAnswerData.answer = selectedOptionInput.value;
    } else {
        // If no option is selected when moving away, ensure it's marked as NO_ANSWER
        // only if it wasn't answered before.
        if (!currentAnswerData.answer || currentAnswerData.answer === "NO_ANSWER") {
             currentAnswerData.answer = "NO_ANSWER";
        }
    }
    
    currentAnswerData.timeSpent = (parseFloat(currentAnswerData.timeSpent) + timeSpentOnThisQuestion).toFixed(2);
    studentAnswers[questionId] = currentAnswerData;
    // console.log("Recorded answer for " + questionId + ":", studentAnswers[questionId]);
    updateNavigator(); // Update navigator immediately after recording
}


function jumpToQuestion(index) {
    if (index < 0 || index >= currentQuizQuestions.length) return;
    recordAnswer(); // Record answer for the current question before jumping
    currentQuestionIndex = index;
    renderQuestion();
}

function submitQuizData() {
    if (quizTimerInterval) clearInterval(quizTimerInterval); // Stop the timer
    console.log("Submitting quiz data...");
    const submissions = [];
    const timestamp = new Date().toISOString();
    const quizName = quizTitle.textContent.replace(/ /g, '_'); // Get quiz name from title

    currentQuizQuestions.forEach(question => {
        const questionId = question.question_id;
        const userAnswerData = studentAnswers[questionId] || { answer: "NO_ANSWER", timeSpent: 0 };
        const isCorrect = (userAnswerData.answer === question.correct_answer); // Simple correctness check

        submissions.push({
            timestamp: timestamp,
            student_gmail_id: studentEmail,
            quiz_name: quizName,
            question_id: questionId,
            student_answer: userAnswerData.answer,
            is_correct: isCorrect, // This requires correct_answer field in your JSON
            time_spent_seconds: userAnswerData.timeSpent
        });
    });

    console.log("Data to submit:", submissions);

    // Hide quiz, show confirmation immediately for better UX
    if(quizArea) quizArea.classList.add('hidden');
    if(confirmationScreen) confirmationScreen.classList.remove('hidden');


    fetch(APPS_SCRIPT_WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors', // Important for Apps Script when not needing response content directly
        cache: 'no-cache',
        headers: {
            'Content-Type': 'application/json',
        },
        redirect: 'follow',
        body: JSON.stringify(submissions) // Send the array of submissions
    })
    .then(response => {
        // With no-cors, we can't directly inspect the response, but can assume success if no network error
        console.log('Submission attempt finished. Check Google Sheet.');
        // Since we showed confirmation immediately, no further UI change needed here on success
    })
    .catch((error) => {
        console.error('Error submitting quiz:', error);
        alert('There was an error submitting your quiz. Please try again or contact support.');
        // Optionally, re-show quiz area or provide a retry mechanism
        if(confirmationScreen) confirmationScreen.classList.add('hidden'); // Hide confirmation if error
        if(quizArea) quizArea.classList.remove('hidden'); // Show quiz area again
    });
}
