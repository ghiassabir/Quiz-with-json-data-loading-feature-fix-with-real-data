// --- script.js ---

// --- CONFIGURATION ---
// IMPORTANT: Update this URL to the RAW link of the FOLDER containing your JSON files on GitHub.
// It should end with a trailing slash '/'. Example:
// const GITHUB_JSON_BASE_URL = 'https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO_NAME/main/data/json/';
const GITHUB_JSON_BASE_URL = 'https://raw.githubusercontent.com/ghiassabir/New-Approach-Quiz-and-Dashboard-11-june/main/data/json/'; // USE YOUR ACTUAL PATH
const APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwneCF0xq9X-F-9AIxAiHpYFmRTErCzCPXlsWRloLRDWBGqwLEZC4NldCCAuND0jxUL/exec';

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
const timerDisplay = document.getElementById('timer');

// --- STATE MANAGEMENT VARIABLES ---
let currentQuizQuestions = [];
let studentAnswers = {};
let markedForReview = new Set();
let currentQuestionIndex = 0;
let questionStartTime = 0;
let studentEmail = '';
let quizTotalTime = 0;
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

    if (nextButton) nextButton.addEventListener('click', () => { recordAnswer(); jumpToQuestion(currentQuestionIndex + 1); });
    if (prevButton) prevButton.addEventListener('click', () => { recordAnswer(); jumpToQuestion(currentQuestionIndex - 1); });
    if (submitButton) submitButton.addEventListener('click', () => { recordAnswer(); submitQuizData(); });
    if (markReviewBtn) markReviewBtn.addEventListener('click', toggleMarkForReview);
});

function startQuizTimer(durationSeconds) {
    let timeLeft = durationSeconds;
    if (quizTimerInterval) clearInterval(quizTimerInterval); // Clear any existing timer
    updateTimerDisplay(timeLeft);

    quizTimerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay(timeLeft);
        if (timeLeft <= 0) {
            clearInterval(quizTimerInterval);
            alert("Time's up!");
            recordAnswer();
            submitQuizData();
        }
    }, 1000);
}

function updateTimerDisplay(seconds) {
    if (!timerDisplay) return;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function startQuiz() {
    if (studentEmailInput) {
        studentEmail = studentEmailInput.value;
        if (!studentEmail || !studentEmail.includes('@')) {
            alert('Please enter a valid email address.');
            return;
        }
        localStorage.setItem('satHubStudentEmail', studentEmail);
    } else {
        // Fallback if email input isn't on the page (e.g., direct quiz link)
        studentEmail = localStorage.getItem('satHubStudentEmail') || "anonymous@example.com";
    }


    const urlParams = new URLSearchParams(window.location.search);
    let quizNameFromUrl = urlParams.get('quiz');

    if (!quizNameFromUrl) {
        console.warn("No 'quiz' URL parameter found. Using 'DT-T0-RW-M1' as a default for testing.");
        quizNameFromUrl = "DT-T0-RW-M1"; // Default for testing
    }

    if (quizTitle) {
        quizTitle.textContent = quizNameFromUrl.replace(/_/g, ' ').replace(/-/g, ' ');
    }
    loadQuestions(quizNameFromUrl);
}

function loadQuestions(quizName) {
    if (startButton) {
        startButton.textContent = "Loading...";
        startButton.disabled = true;
    }
    if(quizArea) quizArea.classList.add('hidden');
    if(welcomeScreen) welcomeScreen.classList.add('hidden');


    const quizJsonUrl = `${GITHUB_JSON_BASE_URL}${quizName}.json`;
    console.log(`Fetching quiz data from: ${quizJsonUrl}`);

    fetch(quizJsonUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} while fetching ${quizJsonUrl}. Make sure the file exists and the URL is correct.`);
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
                if(quizArea) quizArea.classList.remove('hidden');

                studentAnswers = {};
                markedForReview.clear();
                currentQuestionIndex = 0;
                questionStartTime = 0; 

                // Example: Set quiz duration (e.g., 1.5 minutes per question)
                // You should ideally get this from quiz metadata if available
                let timePerQuestion = 90; // 1.5 minutes in seconds
                if (quizName.toLowerCase().includes("math")) { // Simple heuristic
                    timePerQuestion = 120; // 2 minutes for math
                }
                quizTotalTime = currentQuizQuestions.length * timePerQuestion; 
                
                startQuizTimer(quizTotalTime);
                buildQuestionNavigator();
                renderQuestion();
            } else {
                throw new Error(`No questions found for quiz "${quizName}" or data array is empty in ${quizJsonUrl}`);
            }
        })
        .catch(error => {
            console.error("Error during loadQuestions:", error);
            alert(`Failed to load quiz: ${error.message}. Please check the console, the quiz name, and the JSON file URL.`);
            if(welcomeScreen) welcomeScreen.classList.remove('hidden');
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
    optionsContainer.innerHTML = '';
    questionImage.classList.add('hidden');
    questionImage.src = ''; // Clear previous image

    const question = currentQuizQuestions[currentQuestionIndex];
    if (!question) {
        console.error(`Question data not found for index: ${currentQuestionIndex}`);
        return;
    }

    questionText.innerHTML = question.question_text || "Question text is missing.";

    if (question.image_url) {
        // Assuming your image_url in JSON is relative to a base path or a full URL
        // If relative to where your JSONs are, construct full path if needed
        // For now, let's assume it's a full URL or correctly relative to quiz.html
        questionImage.src = question.image_url;
        questionImage.classList.remove('hidden');
    }

    ['a', 'b', 'c', 'd'].forEach(optKey => {
        const optionText = question[`option_${optKey}`];
        if (optionText !== undefined && optionText !== null && optionText.trim() !== "") {
            const optionElement = document.createElement('div');
            optionElement.className = 'answer-option p-4 rounded-lg';
            
            const escapedOptionText = optionText.replace(/"/g, '"'); // Escape quotes for value attribute
            optionElement.innerHTML = `<label class="flex items-center cursor-pointer w-full"><input type="radio" name="answer" value="${escapedOptionText}" class="mr-3 shrink-0"><span></span></label>`;
            optionElement.querySelector('span').innerHTML = optionText; // Set content for MathJax
            
            optionElement.addEventListener('click', (e) => {
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
        MathJax.typesetPromise([questionText, optionsContainer])
            .catch((err) => console.error('MathJax typeset error:', err));
    }

    updateUI();
    questionStartTime = Date.now();
}

function handleOptionSelection() {
    if(!optionsContainer) return;
    document.querySelectorAll('#optionsContainer .answer-option').forEach(el => {
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
        btn.className = 'question-nav-btn p-2 rounded';
        btn.dataset.index = index;
        btn.onclick = () => jumpToQuestion(index);
        questionNavigator.appendChild(btn);
    });
}

function updateNavigator() {
    if (!questionNavigator) return;
    const buttons = questionNavigator.querySelectorAll('.question-nav-btn');
    buttons.forEach((btn, index) => {
        if (!currentQuizQuestions[index]) return;
        const questionId = currentQuizQuestions[index].question_id;
        btn.classList.remove('current', 'answered', 'unanswered', 'marked');
        if (index === currentQuestionIndex) btn.classList.add('current');
        
        if (studentAnswers[questionId] && studentAnswers[questionId].answer && studentAnswers[questionId].answer !== "NO_ANSWER") {
            btn.classList.add('answered');
        } else {
            btn.classList.add('unanswered');
        }
        if (markedForReview.has(questionId)) btn.classList.add('marked');
    });
}

function updateNavigation() {
    if (!prevButton || !nextButton || !submitButton) return;
    prevButton.disabled = currentQuestionIndex === 0;
    const isLastQuestion = currentQuestionIndex === currentQuizQuestions.length - 1;
    nextButton.classList.toggle('hidden', isLastQuestion);
    submitButton.classList.toggle('hidden', !isLastQuestion || currentQuizQuestions.length === 0);
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
    if (!currentQuizQuestions || currentQuizQuestions.length === 0 || !currentQuizQuestions[currentQuestionIndex]) {
        return; 
    }

    const questionId = currentQuizQuestions[currentQuestionIndex].question_id;
    const selectedOptionInput = optionsContainer ? optionsContainer.querySelector('input[name="answer"]:checked') : null;
    const timeSpentOnThisQuestion = questionStartTime > 0 ? (Date.now() - questionStartTime) / 1000 : 0;

    let currentAnswerData = studentAnswers[questionId] || { answer: "NO_ANSWER", timeSpent: "0.00" };
    
    if (selectedOptionInput) {
        currentAnswerData.answer = selectedOptionInput.value;
    } else {
        // Only mark as NO_ANSWER if it wasn't answered before on this attempt
        if (!currentAnswerData.answer || currentAnswerData.answer === "NO_ANSWER") {
             currentAnswerData.answer = "NO_ANSWER";
        }
    }
    
    currentAnswerData.timeSpent = (parseFloat(currentAnswerData.timeSpent) + timeSpentOnThisQuestion).toFixed(2);
    studentAnswers[questionId] = currentAnswerData;
    updateNavigator();
}

function jumpToQuestion(index) {
    if (index < 0 || index >= currentQuizQuestions.length) return;
    // recordAnswer(); // Record answer for the current question before jumping is already called by listeners
    currentQuestionIndex = index;
    renderQuestion();
}

function submitQuizData() {
    if (quizTimerInterval) clearInterval(quizTimerInterval);
    recordAnswer(); // Ensure the very last question's answer is recorded

    console.log("Submitting quiz data...");
    const submissions = [];
    const timestamp = new Date().toISOString();
    const urlParams = new URLSearchParams(window.location.search);
    const quizName = urlParams.get('quiz') || "UNKNOWN_QUIZ"; // Get quiz name from URL or a default


    currentQuizQuestions.forEach(question => {
        const questionId = question.question_id;
        const userAnswerData = studentAnswers[questionId] || { answer: "NO_ANSWER", timeSpent: "0.00" };
        const isCorrect = (userAnswerData.answer === question.correct_answer);

        submissions.push({
            timestamp: timestamp,
            student_gmail_id: studentEmail,
            quiz_name: quizName,
            question_id: questionId,
            student_answer: userAnswerData.answer,
            is_correct: isCorrect.toString().toUpperCase(), // Send as "TRUE" or "FALSE" string
            time_spent_seconds: userAnswerData.timeSpent
        });
    });

    console.log("Data to submit:", JSON.stringify(submissions)); // Log the stringified version

    if(quizArea) quizArea.classList.add('hidden');
    if(confirmationScreen) confirmationScreen.classList.remove('hidden');

    fetch(APPS_SCRIPT_WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors', 
        cache: 'no-cache',
        // 'Content-Type': 'application/json' is often implicitly set by fetch for stringified JSON,
        // but for 'no-cors' to Apps Script, it's better to send as 'text/plain' for the body
        // and let Apps Script parse JSON.parse(e.postData.contents).
        // However, if your Apps Script expects application/json, keep it.
        // For simplicity with 'no-cors', often text/plain is more reliable if a complex Content-Type causes issues.
        // Let's stick to text/plain for the body with `no-cors`
        headers: {
             'Content-Type': 'text/plain', // Sending as text/plain for no-cors robustness
        },
        redirect: 'follow',
        body: JSON.stringify(submissions) 
    })
    .then(() => { // For no-cors, response object is opaque and not very useful
        console.log('Submission attempt finished. Check Google Sheet.');
    })
    .catch((error) => {
        console.error('Error submitting quiz:', error);
        alert('There was an error submitting your quiz. Please try again or contact support.');
        if(confirmationScreen) confirmationScreen.classList.add('hidden');
        if(quizArea) quizArea.classList.remove('hidden');
    });
}
