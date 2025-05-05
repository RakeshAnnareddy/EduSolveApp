document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const searchInput = document.getElementById('searchInput');
    const actionButton = document.getElementById('actionButton');
    const actionIcon = document.getElementById('actionIcon');
    const fileInput = document.getElementById('fileInput');
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    const fileUpload = document.getElementById('fileUpload');
    const readerContent = document.getElementById('reader-content');
    const fileNameDisplay = document.getElementById('file-name');
    const cancelUploadButton = document.getElementById('cancelUpload');
    const initialUploadArea = document.getElementById('initial-upload-area');
    const newUploadButton = document.getElementById('newUpload');

    let isSidebarCollapsed = true; // Start in collapsed state

    // Apply initial collapsed state
    document.body.classList.add('sidebar-collapsed');
    sidebar.classList.add('collapsed');
    mainContent.classList.add('collapsed');

    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            isSidebarCollapsed = !isSidebarCollapsed;
            sidebar.classList.toggle('collapsed', isSidebarCollapsed);
            mainContent.classList.toggle('collapsed', isSidebarCollapsed ? 'collapsed' : 'expanded');
            document.body.classList.toggle('sidebar-collapsed', isSidebarCollapsed);
        });
    }

    if (newUploadButton) {
        newUploadButton.addEventListener('click', function() {
            fileUpload.click(); // Trigger file input click
        });
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
            if (fileType.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    readerContent.appendChild(img);
                    // No need for inline style here, moved to CSS
                }
                reader.readAsDataURL(file);
            } else if (fileType === 'application/pdf') {
                const embed = document.createElement('embed');
                embed.src = URL.createObjectURL(file);
                embed.type = 'application/pdf';
                // No need for inline style here, moved to CSS
                readerContent.appendChild(embed);
            } else {
                readerContent.textContent = `Unsupported file type: ${fileType}. Please upload an image or PDF.`;
            }
        }
    });

    function adjustUserMessageWidth() {
        document.querySelectorAll(".user-message").forEach(msg => {
            let textLength = msg.innerText.length;
            let baseWidth = 100;
            let maxWidth = 300;
            let calculatedWidth = Math.min(baseWidth + textLength * 8, maxWidth);
            msg.style.maxWidth = `${calculatedWidth}px`;
        });
    }

    function scrollToBottom() {
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    const observer = new MutationObserver(() => {
        adjustUserMessageWidth();
        scrollToBottom();
    });

    observer.observe(chatBox, { childList: true });

    adjustUserMessageWidth();
    scrollToBottom();

    searchInput.addEventListener('input', function () {
        if (searchInput.value.trim() !== '') {
            actionIcon.style.display = 'none';
            actionButton.innerHTML = `
                <span class="send-button">
                    <svg width="24" height="24" viewBox="0 0 24 24">
                        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" fill="#777"/>
                    </svg>
                </span>
            `;
            actionButton.onclick = sendMessage;
        } else {
            resetActionButton();
        }
    });

    searchInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendMessage();
        }
    });

    fileInput.addEventListener('change', function () {
        if (fileInput.files.length > 0) {
            for (let file of fileInput.files) {
                console.log("File selected for chat:", file.name);
                // You can add logic here to handle file uploads in the chat if needed
            }
            // Clear the file input after handling (optional)
            fileInput.value = '';
        }
    });

    function sendMessage() {
        const userInput = searchInput.value.trim();
        if (!userInput) return;

        const userMessage = document.createElement('div');
        userMessage.classList.add('user-message');
        userMessage.textContent = userInput;
        chatBox.appendChild(userMessage);

        searchInput.value = "";
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
});


document.getElementById("submitQuery").addEventListener("click", async () => {
    const selectedText = window.getSelection().toString().trim();
    const query = document.getElementById("userQuery").value.trim();
  
    if (!selectedText || !query) {
        alert("Please select some text and provide a query.");
        return;
    }

    const res = await fetch("https://edusolveapp.onrender.com/analyze-selection", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ selected_text: selectedText, query })
    });

    const data = await res.json();
    document.getElementById("response").innerText = data.response || "No response received.";
});


document.getElementById('fileInput').addEventListener('change', async function (event) {
    const file = event.target.files[0];
  
    if (!file) return;
  
    const formData = new FormData();
    formData.append('file', file);
  
    try {
      const response = await fetch('https://edusolveapp.onrender.com/upload-docx', {
        method: 'POST',
        body: formData,
      });
  
      const data = await response.json();
  
      if (data.content) {
        // Display the DOCX content in your app (adjust DOM target as needed)
        document.getElementById('docxContent').textContent = data.content;
      } else {
        console.error('Error:', data.error);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
  });
  