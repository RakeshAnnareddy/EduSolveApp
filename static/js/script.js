document.addEventListener("DOMContentLoaded", function () {
    // --- Get all necessary DOM elements ---
    const chatBox = document.getElementById("chat-box");
    const searchInput = document.getElementById('searchInput');
    const actionButton = document.getElementById('actionButton');
    const actionIcon = document.getElementById('actionIcon');
    const explainButton = document.getElementById('explainButton'); // Ensure this ID matches your HTML
    const summarizeButton = document.getElementById('summarizeButton'); // Ensure this ID matches your HTML
    const fileUpload = document.getElementById('fileUpload');
    const readerContent = document.getElementById('reader-content');
    const fileNameDisplay = document.getElementById('file-name');
    const cancelUploadButton = document.getElementById('cancelUpload');
    const initialUploadArea = document.getElementById('initial-upload-area');

    // Sidebar elements (ensure these exist in your HTML)
    const sidebar = document.getElementById("sidebar");
    const mainContent = document.getElementById("main-content");
    const menuToggle = document.getElementById("menu-toggle");

    let currentPdfId = null; // Store the current PDF ID received from the server

    // --- Utility Functions ---
    function scrollToBottom() {
        if (chatBox) { // Add a check to ensure chatBox exists
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    }

    // Observer to automatically scroll chat to bottom when new messages are added
    const observer = new MutationObserver(() => {
        scrollToBottom();
    });

    if (chatBox) { // Only observe if chatBox exists
        observer.observe(chatBox, { childList: true });
        scrollToBottom(); // Scroll to bottom initially
    }


    // --- Search Input and Send Message Logic ---
    searchInput.addEventListener('input', function () {
        this.rows = this.value.split('\n').length; // Auto-adjust rows based on content
        if (searchInput.value.trim() !== '') {
            actionIcon.style.display = 'none';
            actionButton.innerHTML = `<span class="send-button"><svg width="24" height="24" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" fill="#777"/></svg></span>`;
            actionButton.onclick = sendMessage;
        } else {
            resetActionButton();
        }
    });

    searchInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && event.shiftKey) {
            // Insert a new line without sending the message
            const start = this.selectionStart;
            const end = this.selectionEnd;
            this.value = this.value.substring(0, start) + '\n' + this.value.substring(end);
            this.selectionStart = this.selectionEnd = start + 1;
            event.preventDefault(); // Prevent default Enter key behavior (sending form)
            this.rows = this.value.split('\n').length; // Adjust rows
        } else if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault(); // Prevent default Enter key behavior
            sendMessage();
        }
    });

    function sendMessage() {
        const userInput = searchInput.value.trim();
        if (!userInput) return;

        const userMessage = document.createElement('div');
        userMessage.classList.add('user-message');
        userMessage.innerHTML = userInput.replace(/\n/g, '<br>');
        chatBox.appendChild(userMessage);

        searchInput.value = "";
        searchInput.rows = 1;
        resetActionButton();

        // Add loading state
        const loadingMessage = document.createElement('div');
        loadingMessage.classList.add('bot-message');
        loadingMessage.innerHTML = '<div class="loading">Generating response...</div>';
        chatBox.appendChild(loadingMessage);
        scrollToBottom();

        fetch("https://edusolveapp.onrender.com/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: userInput,
                user_id: "test_user_001", // Make sure this user_id is handled consistently
                focused_response: true
            })
        })
        .then(response => response.json())
        .then(data => {
            loadingMessage.remove(); // Remove loading message

            let botResponse = data.response;
            let formattedResponse = formatBotResponse(botResponse);

            const botMessage = document.createElement('div');
            botMessage.classList.add('bot-message');
            botMessage.innerHTML = formattedResponse;
            chatBox.appendChild(botMessage);

            scrollToBottom();
        })
        .catch(error => {
            loadingMessage.remove(); // Remove loading message
            console.error("Error generating response:", error);
            const errorMessage = document.createElement('div');
            errorMessage.classList.add('bot-message');
            errorMessage.innerHTML = `Error generating response. Please try again later.`;
            chatBox.appendChild(errorMessage);
            scrollToBottom();
        });
    }

    function resetActionButton() {
        actionIcon.style.display = 'inline-block';
        actionButton.innerHTML = `
            <span id="actionIcon" class="mic-icon">
                <svg width="24" height="24" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" fill="#777"/>
                </svg>
            </span>
        `;
        actionButton.onclick = undefined; // Clear previous click handler
    }

    function formatBotResponse(botResponse) {
        let formattedResponse = botResponse;

        // =========================================================================
        //  Heading Styles
        //  -----------------------------------------------------------------------
        //  Detect and style headings (h1 to h6) based on '#' prefixes.
        // =========================================================================
        formattedResponse = formattedResponse.replace(/^# (.*)$/gm, '<h1>$1</h1>');
        formattedResponse = formattedResponse.replace(/^## (.*)$/gm, '<h2>$1</h2>');
        formattedResponse = formattedResponse.replace(/^### (.*)$/gm, '<h3>$1</h3>');
        formattedResponse = formattedResponse.replace(/^#### (.*)$/gm, '<h4>$1</h4>');
        formattedResponse = formattedResponse.replace(/^##### (.*)$/gm, '<h5>$1</h5>');
        formattedResponse = formattedResponse.replace(/^###### (.*)$/gm, '<h6>$1</h6>');

        // =========================================================================
        //  Code Block Styles
        //  -----------------------------------------------------------------------
        //  Detect and style code blocks, handling language-specific comments.
        // =========================================================================
        formattedResponse = formattedResponse.replace(/```(\w+)?\n([\s\S]+?)```/g, (match, lang, code) => {
            lang = lang || "plaintext";

            // Function to generate language-specific comment prefix
            function getCommentPrefix(language) {
                switch (language.toLowerCase()) {
                    case "javascript":
                    case "java":
                    case "c":
                    case "cpp":
                    case "c#":
                    case "go":
                    case "rust":
                        return "// ";
                    case "python":
                    case "ruby":
                    case "perl":
                    case "bash":
                    case "shell":
                    case "yaml":
                    case "dockerfile":
                    case "powershell":
                        return "# ";
                    case "php":
                        return "// ";
                    case "sql":
                    case "mysql":
                    case "postgresql":
                        return "-- ";
                    default:
                        return "# ";
                }
            }

            const commentPrefix = getCommentPrefix(lang);

            // Clean up stray h1-h6 tags and treat their content as comments
            const cleanedCode = code.replace(/<h\d>([^<]+)<\/h\d>/g, (match, content) => {
                const commentedLines = content.split('\n').map(line => `${commentPrefix}${line}`);
                return commentedLines.join('\n');
            });

            return `
                <div class="code-block">
                    <span class="language-indicator">${escapeHTML(lang)}</span>
                    <pre><code>${escapeHTML(cleanedCode)}</code></pre>
                    <button class="copy-btn" onclick="copyCode(this)">Copy</button>
                </div>
            `;
        });

        // =========================================================================
        //  Unordered List Styles
        //  -----------------------------------------------------------------------
        //  Detect and style unordered lists.
        // =========================================================================
        // Ensure lists are properly formed and not nested incorrectly by replacing temporary markers
        formattedResponse = formattedResponse.replace(/\n\* (.+)/g, '<ul><li>$1</li></ul>');
        formattedResponse = formattedResponse.replace(/<\/ul>\s*<ul>/g, '');


        // =========================================================================
        //  Ordered List Styles
        //  -----------------------------------------------------------------------
        //  Detect and style ordered lists.
        // =========================================================================
        // Ensure lists are properly formed and not nested incorrectly by replacing temporary markers
        formattedResponse = formattedResponse.replace(/\n\d+\.\s+(.+)/g, '<ol><li>$1</li></ol>');
        formattedResponse = formattedResponse.replace(/<\/ol>\s*<ol>/g, '');

        // =========================================================================
        //  Table Styles - NOTE: This regex needs to be more robust for full Markdown tables.
        //  -----------------------------------------------------------------------
        //  Detect and style tables. Basic example, may need enhancement for complex tables.
        // =========================================================================
        // This simple regex for tables is problematic. A more robust parser is needed for full Markdown tables.
        // For now, I'm commenting it out as it often misinterprets pipe characters.
        /*
        formattedResponse = formattedResponse.replace(/\|(.+?)\|(.+?)\|/g, (match, header, data) => {
            const headers = header.split('|').map(h => h.trim());
            const rows = data.split('|').map(r => r.trim());
            let tableHTML = '<table class="ai-table">';
            tableHTML += '<thead><tr>';
            headers.forEach(h => tableHTML += `<th>${h}</th>`);
            tableHTML += '</tr></thead><tbody><tr>';
            rows.forEach(r => tableHTML += `<td>${r}</td>`);
            tableHTML += '</tr></tbody></table>';
            return tableHTML;
        });
        */

        return formattedResponse;
    }

    // =============================================================================
    //  escapeHTML Function
    //  ---------------------------------------------------------------------------
    //  Escapes HTML special characters to prevent XSS and ensure proper display.
    // =============================================================================
    function escapeHTML(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    // =============================================================================
    //  copyCode Function (Global - accessible from onclick)
    //  ---------------------------------------------------------------------------
    //  Copies code from a code block to the clipboard.
    // =============================================================================
    window.copyCode = function(button) {
        let codeBlock = button.previousElementSibling.querySelector('code').innerText;
        navigator.clipboard.writeText(codeBlock)
            .then(() => {
                button.innerText = "Copied!";
                setTimeout(() => button.innerText = "Copy", 2000);
            })
            .catch(err => console.error("Error copying code:", err));
    };


    // --- File Upload and PDF Processing Logic ---
    if (cancelUploadButton && fileNameDisplay && readerContent && initialUploadArea) {
        cancelUploadButton.addEventListener('click', function() {
            fileUpload.value = ''; // Clear the file input
            fileNameDisplay.style.display = 'none';
            cancelUploadButton.style.display = 'none';
            readerContent.innerHTML = '';
            readerContent.style.display = 'flex'; // Reset to flex for initial upload area
            readerContent.appendChild(initialUploadArea);
            currentPdfId = null; // Clear the PDF ID
            // Optionally disable buttons again if no PDF is loaded
            if (summarizeButton) summarizeButton.disabled = true;
            if (explainButton) explainButton.disabled = true;
        });
    }

    // Main file upload change listener
    fileUpload.addEventListener('change', async function() {
        if (this.files.length > 0) {
            const file = this.files[0];
            fileNameDisplay.textContent = file.name;
            fileNameDisplay.style.display = 'block';
            cancelUploadButton.style.display = 'block';

            // --- Enable the summarize and explain buttons IMMEDIATELY after file selection ---
            if (summarizeButton) summarizeButton.disabled = false;
            if (explainButton) explainButton.disabled = false;
            console.log("Summarize and Explain buttons enabled."); // Debugging line

            // Create PDF viewer container
            const pdfViewer = document.createElement('div');
            pdfViewer.id = 'pdf-viewer';
            pdfViewer.style.width = '100%';
            pdfViewer.style.height = '100%';
            pdfViewer.style.marginBottom = '20px';
            pdfViewer.style.border = '1px solid #ddd';
            pdfViewer.style.borderRadius = '4px';
            pdfViewer.style.overflow = 'hidden';

            // Create iframe for PDF viewer
            const viewerFrame = document.createElement('iframe');
            viewerFrame.id = 'pdf-iframe';
            viewerFrame.style.width = '100%';
            viewerFrame.style.height = '100%';
            viewerFrame.style.border = 'none';
            pdfViewer.appendChild(viewerFrame);

            // Clear previous content and add new viewer
            readerContent.innerHTML = '';
            readerContent.style.display = 'block'; // Ensure it's block for PDF viewer
            readerContent.appendChild(pdfViewer);

            // Create object URL for the PDF and set it as the iframe's src
            const pdfUrl = URL.createObjectURL(file);
            viewerFrame.src = pdfUrl;

            // Upload and analyze the PDF
            const formData = new FormData();
            formData.append('pdf', file);
            // Use a consistent user_id, either from localStorage or hardcoded as per your backend needs
            const userId = localStorage.getItem("user_id") || "test_user_001";
            formData.append('user_id', userId);

            // Add loading message for PDF analysis
            const pdfLoadingMessage = document.createElement('div');
            pdfLoadingMessage.classList.add('bot-message');
            pdfLoadingMessage.innerHTML = '<div class="loading">Analyzing PDF content...</div>';
            chatBox.appendChild(pdfLoadingMessage);
            scrollToBottom();

            try {
                const response = await fetch('https://edusolveapp.onrender.com/upload-pdf', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();
                console.log("Server Response (PDF Upload):", data);

                // Remove loading message for PDF analysis
                pdfLoadingMessage.remove();

                if (data.error) {
                    throw new Error(data.error);
                }

                // Check for 'main_topics' specifically within 'structured_content'
                if (!data.structured_content || !data.structured_content.main_topics) {
                    throw new Error("Server response missing 'structured_content' or 'main_topics'.");
                }

                currentPdfId = data.pdf_id;
                const mainTopics = data.structured_content.main_topics;

                // Display analysis result
                const botMessage = document.createElement('div');
                botMessage.classList.add('bot-message');
                botMessage.innerHTML = `
                    <h3>PDF Analysis Complete!</h3>
                    <p><strong>Identified Topics:</strong> ${mainTopics.join(', ')}</p>
                    <p>Click "Summarize" to get a concise summary or "Explain" to get detailed explanations with real-world examples.</p>
                `;
                chatBox.appendChild(botMessage);
                scrollToBottom();

                // If the second fileUpload event listener was intended for analysis display, merge it here.
                // The original code had a separate listener doing analysis.
                if (data.analysis) {
                    const analysisOutput = document.getElementById("analysisOutput");
                    if (analysisOutput) {
                        analysisOutput.innerText = data.analysis;
                    } else {
                        // If there's no dedicated 'analysisOutput' element, append to chatBox
                        const analysisMessage = document.createElement('div');
                        analysisMessage.classList.add('bot-message');
                        analysisMessage.innerHTML = `<h3>Raw Analysis Output:</h3><pre>${escapeHTML(data.analysis)}</pre>`;
                        chatBox.appendChild(analysisMessage);
                        scrollToBottom();
                    }
                }

            } catch (error) {
                pdfLoadingMessage.remove(); // Remove loading message
                console.error("Error analyzing PDF:", error);
                const errorMessage = document.createElement('div');
                errorMessage.classList.add('bot-message');
                errorMessage.innerHTML = `Error analyzing PDF: ${error.message || error}. Please try again.`;
                chatBox.appendChild(errorMessage);
                scrollToBottom();
            }
        }
    });

    // Add styles for the PDF viewer (can be moved to CSS file)
    const pdfViewerStyle = document.createElement('style');
    pdfViewerStyle.textContent = `
        #pdf-viewer {
            background-color: #f5f5f5;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        #pdf-iframe {
            background-color: white;
        }
    `;
    document.head.appendChild(pdfViewerStyle);

    // --- Summarize Button Handler ---
    if (summarizeButton) { // Ensure button exists before adding listener
        summarizeButton.addEventListener('click', function() {
            if (!currentPdfId) {
                alert('Please upload a PDF first to summarize!');
                return;
            }

            const loadingMessage = document.createElement('div');
            loadingMessage.classList.add('bot-message');
            loadingMessage.innerHTML = '<div class="loading">Generating summary...</div>';
            chatBox.appendChild(loadingMessage);
            scrollToBottom();

            fetch('https://edusolveapp.onrender.com/get-suggestions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pdf_id: currentPdfId,
                    topic: 'summary',
                    focused_response: true
                })
            })
            .then(response => response.json())
            .then(data => {
                loadingMessage.remove(); // Remove loading message

                if (data.error) {
                    throw new Error(data.error);
                }

                const summaryMessage = document.createElement('div');
                summaryMessage.classList.add('bot-message');
                summaryMessage.innerHTML = formatBotResponse(data.suggestions?.summary || 'Summary not available.');
                chatBox.appendChild(summaryMessage);
                scrollToBottom();
            })
            .catch(error => {
                loadingMessage.remove(); // Remove loading message
                console.error("Error generating summary:", error);
                const errorMessage = document.createElement('div');
                errorMessage.classList.add('bot-message');
                errorMessage.innerHTML = `Error generating summary: ${error.message || error}. Please try again later.`;
                chatBox.appendChild(errorMessage);
                scrollToBottom();
            });
        });
    }


    // --- Explain Button Handler ---
    if (explainButton) { // Ensure button exists before adding listener
        explainButton.addEventListener('click', function() {
            if (!currentPdfId) {
                alert('Please upload a PDF first to get an explanation!');
                return;
            }

            const loadingMessage = document.createElement('div');
            loadingMessage.classList.add('bot-message');
            loadingMessage.innerHTML = '<div class="loading">Generating explanation...</div>';
            chatBox.appendChild(loadingMessage);
            scrollToBottom();

            fetch('https://edusolveapp.onrender.com/get-suggestions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pdf_id: currentPdfId,
                    topic: 'explanation',
                    level: 'high_school', // You might want to make this configurable
                    focused_response: true
                })
            })
            .then(response => response.json())
            .then(data => {
                loadingMessage.remove(); // Remove loading message

                if (data.error) {
                    throw new Error(data.error);
                }

                const explanationMessage = document.createElement('div');
                explanationMessage.classList.add('bot-message');

                let formattedExplanation = '';
                if (data.suggestions?.explanation) {
                    formattedExplanation = formatBotResponse(data.suggestions.explanation);
                } else if (data.suggestions?.concepts) { // Fallback if 'explanation' isn't direct
                    formattedExplanation = formatBotResponse(data.suggestions.concepts);
                }

                explanationMessage.innerHTML = formattedExplanation || 'Explanation not available.';
                chatBox.appendChild(explanationMessage);
                scrollToBottom();
            })
            .catch(error => {
                loadingMessage.remove(); // Remove loading message
                console.error("Error generating explanation:", error);
                const errorMessage = document.createElement('div');
                errorMessage.classList.add('bot-message');
                errorMessage.innerHTML = `Error generating explanation: ${error.message || error}. Please try again later.`;
                chatBox.appendChild(errorMessage);
                scrollToBottom();
            });
        });
    }

    // --- Loading Animation Styles (can be moved to CSS file) ---
    const style = document.createElement('style');
    style.textContent = `
        .loading {
            display: inline-block;
            padding: 10px;
            color: #666;
        }
        .loading:after {
            content: '...';
            animation: dots 1.5s steps(5, end) infinite;
        }
        @keyframes dots {
            0%, 20% { content: '.'; }
            40% { content: '..'; }
            60% { content: '...'; }
            80%, 100% { content: ''; }
        }
    `;
    document.head.appendChild(style);


    // --- Chatbox Selection Prevention Logic ---
    // Consolidated this into the main DOMContentLoaded
    if (chatBox) {
        chatBox.addEventListener('selectstart', function(e) {
            if (e.target.classList.contains('bot-message') || e.target.closest('.bot-message')) {
                e.preventDefault();
            }
        });

        chatBox.addEventListener('mousedown', function(e) {
            // Optional: Prevent default behavior on bot message elements
        });

        chatBox.addEventListener('mouseup', function(e) {
            if (window.getSelection().toString().length > 0 && (e.target.classList.contains('bot-message') || e.target.closest('.bot-message'))) {
                window.getSelection().empty(); // Or window.getSelection().removeAllRanges();
            }
        });

        chatBox.addEventListener('copy', function(e) {
            if (e.target.classList.contains('bot-message') || e.target.closest('.bot-message')) {
                e.preventDefault();
            }
        });

        chatBox.addEventListener('contextmenu', function(e) {
            if (e.target.classList.contains('bot-message') || e.target.closest('.bot-message')) {
                e.preventDefault();
            }
        });
    }

    // --- Sidebar Toggle Logic ---
    // Consolidated this into the main DOMContentLoaded
    if (menuToggle && sidebar && mainContent) { // Ensure these elements exist
        menuToggle.addEventListener("click", () => {
            sidebar.classList.toggle("collapsed");
            mainContent.classList.toggle("collapsed");
        });
    }
}); // This is the ONLY closing brace for the initial DOMContentLoaded.