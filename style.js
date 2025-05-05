document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");

    // Adjust user message width dynamically
    function adjustUserMessageWidth() {
        const messages = document.querySelectorAll(".user-message");
        messages.forEach(msg => {
            let textLength = msg.innerText.length;
            let baseWidth = 100; // Minimum width in pixels
            let maxWidth = 300;  // Maximum width in pixels
            let calculatedWidth = Math.min(baseWidth + textLength * 8, maxWidth);
            msg.style.maxWidth = `${calculatedWidth}px`;
        });
    }

    // Scroll chat to the latest message
    function scrollToBottom() {
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Observe new messages being added
    const observer = new MutationObserver(() => {
        adjustUserMessageWidth();
        scrollToBottom();
    });

    observer.observe(chatBox, { childList: true });

    // Initial adjustments in case of pre-loaded messages
    adjustUserMessageWidth();
    scrollToBottom();
});
