document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const searchInput = document.getElementById('searchInput');
    const actionButton = document.getElementById('actionButton');
    const actionIcon = document.getElementById('actionIcon');
    const explainButton = document.getElementById('explainButton');
    const summarizeButton = document.getElementById('summarizeButton');
    const fileUpload = document.getElementById('fileUpload');
    const readerContent = document.getElementById('reader-content');
    const fileNameDisplay = document.getElementById('file-name');
    const cancelUploadButton = document.getElementById('cancelUpload');
    const initialUploadArea = document.getElementById('initial-upload-area');

    
    function scrollToBottom() {
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    const observer = new MutationObserver(() => {
        scrollToBottom();
    });

    observer.observe(chatBox, { childList: true });
    scrollToBottom();

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
        userMessage.textContent = userInput.replace(/\n/g, '<br>'); // Preserve line breaks in display
        chatBox.appendChild(userMessage);

        searchInput.value = "";
        searchInput.rows = 1; // Reset rows
        resetActionButton();

        fetch("https://edusolveapp.onrender.com/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ prompt: userInput })
        })
        .then(response => response.json())
        .then(data => {
            let botResponse = data.response;
            let formattedResponse = formatBotResponse(botResponse);

            const botMessage = document.createElement('div');
            botMessage.classList.add('bot-message');
            botMessage.innerHTML = formattedResponse;
            chatBox.appendChild(botMessage);

            scrollToBottom();
        })
        .catch(error => {
            console.error("Error:", error);
            chatBox.innerHTML += `<div class="bot-message">Error generating response. Please try again later.</div>`;
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
        actionButton.onclick = undefined;
    }

    function formatBotResponse(botResponse) {
        let formattedResponse = botResponse;

        if (formattedResponse.includes("")) {
            formattedResponse = formattedResponse.replace(/(\w+)?\n([\s\S]+?)/g, (match, lang, code) => {
                lang = lang || "plaintext";
                return `
                    <div class="code-block">
                        <span class="language-indicator">${lang}</span>
                        <pre><code>${escapeHTML(code)}</code></pre>
                        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
                    </div>
                `;
            });
        }

        formattedResponse = formattedResponse.replace(/\n\* (.+)/g, '<ul><li>$1</li></ul>');
        formattedResponse = formattedResponse.replace(/<\/ul>\s*<ul>/g, '');
        formattedResponse = formattedResponse.replace(/\n\d+\.\s+(.+)/g, '<ol><li>$1</li></ol>');
        formattedResponse = formattedResponse.replace(/<\/ol>\s*<ol>/g, '');

        return formattedResponse;
    }

    function escapeHTML(str) {
        return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function copyCode(button) {
        let codeBlock = button.previousElementSibling.previousElementSibling.innerText;
        navigator.clipboard.writeText(codeBlock)
            .then(() => {
                button.innerText = "Copied!";
                setTimeout(() => button.innerText = "Copy", 2000);
            })
            .catch(err => console.error("Error copying:", err));
    }

    if (cancelUploadButton) {
        cancelUploadButton.addEventListener('click', function() {
            fileUpload.value = ''; // Clear the file input
            fileNameDisplay.style.display = 'none';
            cancelUploadButton.style.display = 'none';
            readerContent.innerHTML = '';
            readerContent.style.display = 'flex';
            readerContent.appendChild(initialUploadArea);
        });
    }

    fileUpload.addEventListener('change', function() {
        if (this.files.length > 0) {
            const file = this.files[0];

            fileNameDisplay.textContent = `Selected file: ${file.name}`;
            fileNameDisplay.style.display = 'block';
            cancelUploadButton.style.display = 'inline-block';
            readerContent.innerHTML = '';
            readerContent.style.display = 'block';
            initialUploadArea.remove(); // Remove initial upload area

            const fileType = file.type;
            if (fileType === 'application/pdf') {
                const embed = document.createElement('embed');
                embed.src = URL.createObjectURL(file);
                embed.type = 'application/pdf';
                embed.style.width = '100%'; // Make it fill the container
                embed.style.height = '100%';
                readerContent.appendChild(embed);
            } else if (fileType.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.style.maxWidth = '100%'; // Responsive image
                    img.style.maxHeight = '100%';
                    readerContent.appendChild(img);
                }
                reader.readAsDataURL(file);
            } else {
                readerContent.textContent = `Unsupported file type: ${fileType}. Please upload an image or PDF.`;
            }
        } else {
            // No file selected, you might want to handle this (e.g., show the upload area again)
            readerContent.innerHTML = '';
            readerContent.style.display = 'flex';
            readerContent.appendChild(initialUploadArea);
            fileNameDisplay.style.display = 'none';
            cancelUploadButton.style.display = 'none';
        }
    });

    // Event listeners for Explain and Summarize buttons
    if (explainButton) {
        explainButton.addEventListener('click', function() {
            const selectedText = window.getSelection().toString().trim();
            const currentInput = searchInput.value.trim();
            let prompt = "";
            if (selectedText) {
                prompt = `Explain this: "${selectedText}"`;
            } else if (currentInput) {
                prompt = `Explain this: "${currentInput}"`;
            } else {
                alert("Please select text or enter something to explain.");
                return;
            }
            searchInput.value = prompt;
            sendMessage(); // Or create a specific 'explain' function
        });
    }

    if (summarizeButton) {
        summarizeButton.addEventListener('click', function() {
            const selectedText = window.getSelection().toString().trim();
            const currentInput = searchInput.value.trim();
            let prompt = "";
            if (selectedText) {
                prompt = `Summarize this: "${selectedText}"`;
            } else if (currentInput) {
                prompt = `Summarize this: "${currentInput}"`;
            } else {
                alert("Please select text or enter something to summarize.");
                return;
            }
            searchInput.value = prompt;
            sendMessage(); // Or create a specific 'summarize' function
        });
    }
});


document.addEventListener('DOMContentLoaded', function() {
    const chatBox = document.getElementById('chat-box');

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
});