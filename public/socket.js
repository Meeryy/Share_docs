const socket = io();
const editorContainer = document.getElementById('editor-container');
const status = document.getElementById('status');
const connectedUsers = document.getElementById('connected-users');
const cursors = document.getElementById('cursors');
let username;
let users = {};
let connected = false;
let text = "";
let pendingUpdates = [];




// Add this at the top with existing constants
let highlights = [];

// Add this method to render highlights on the page
function renderHighlights() {
	editorContainer.innerHTML = text; // clear current text
	highlights.forEach(({ start, end, user }) => {
		const highlightedText = `<span style="background-color: yellow;" title="${user}">${text.slice(start, end)}</span>`;
		const beforeText = text.slice(0, start);
		const afterText = text.slice(end);
		// Reconstruct the HTML with highlights
		editorContainer.innerHTML = beforeText + highlightedText + afterText;
	});
}

// Handle mouseup event to send highlight updates
editorContainer.addEventListener('mouseup', () => {
	if (connected) {
		const selection = window.getSelection();
		if (selection.rangeCount > 0) {
			const range = selection.getRangeAt(0);
			const start = range.startOffset;
			const end = range.endOffset;
			const selectedText = range.toString();

			if (selectedText.length > 0) {
				const highlightData = { start, end, user: username };
				socket.emit('COMM_HIGHLIGHT', highlightData);
			}
		}
	}
});



function saveTextToLocal() {
    localStorage.setItem('documentText', text);
}

// Funkce pro odesílání aktualizací
function updateText(newText) {
    const diff = Diff.createPatch('document', text, newText);

    // Uložení do pendingUpdates
    pendingUpdates.push(diff);
    text = newText;

    socket.emit("COMM_DOCUMENT_UPDATE", diff);
}

function applyPendingUpdates() {
    if (pendingUpdates.length === 0) return;

    pendingUpdates.forEach(diff => {
        applyDiff(diff);
    });

    pendingUpdates = [];
}

// Načtení textu z localStorage při spuštění
document.addEventListener('DOMContentLoaded', () => {
    text = localStorage.getItem('documentText') || "Hello world"; // nebo prázdný text
    applyPendingUpdates();
});














// Update highlight rendering in the highlight event listener
socket.on("COMM_HIGHLIGHT", (highlightData) => {
	highlights.push(highlightData);
	renderHighlights();
});

// Remember to call renderHighlights() after applying diffs
socket.on("COMM_DOCUMENT_UPDATE", (incoming) => {
	if (connected) {
		applyDiff(incoming);
		renderHighlights(); // Note the addition here to render highlights
	}
})



;












































function createUser(username)
{
	return {
		name: username,
		ptrX: 0,
		ptrY: 0
	}
}

function updateUsers()
{
	let userText = "";
	let first = true;
	for (let k in users)
	{
		if (!first)
		{
			userText += ", "
		}
		first = false;
		userText += users[k].name;
	}
	connectedUsers.innerText = userText;

	let cursorHtml = "";
	for (let k in users)
	{
		cursorHtml += "<div style=\"position: absolute; background: red; width: 5px; height: 5px; left: "
		cursorHtml += users[k].ptrX + "px; top: "
		cursorHtml += users[k].ptrY + "px;\">"
		cursorHtml += "</div>"
	}
	cursors.innerHTML = cursorHtml;
};

function squashDiff(diff)
{
	for (let index = 0; index < diff.length; ++index)
	{
		if (!diff[index].added)
		{
			delete diff[index].value;
		}
	}
}

function applyDiff(diff)
{
	let index = 0;
	diff.forEach(part =>
	{
		if (part.removed)
		{
			text = text.slice(0, index) + text.slice(index + part.count);
		}
		else if (part.added)
		{
			text = text.slice(0, index) + part.value + text.slice(index);
		}
		index += part.count;
	});
	editorContainer.innerText = text;
}


socket.on("connect", () =>
{
	console.log("Connected to server");
	status.innerText = "Disconnected";
});
socket.on("disconnect", () =>
{
	console.log("Disconnected from server");
	connected = false;
	editorContainer.setAttribute("contenteditable", false);
	status.innerText = "Disconnected";
});

socket.on("COMM_DOCUMENT_SET", (incoming) =>
{
	if (connected)
	{
		text = incoming;
		editorContainer.innerText = text;
	}
})
socket.on("COMM_DOCUMENT_UPDATE", (incoming) =>
{
	if (connected)
	{
		applyDiff(incoming);
	}
})

socket.on("COMM_USERS", (incoming) =>
{
	users = incoming;
	updateUsers();
});

editorContainer.addEventListener('input', () =>
{
	if (connected)
	{
		let diff = Diff.diffChars(text, editorContainer.innerText);
		squashDiff(diff)
		socket.emit('COMM_DOCUMENT_UPDATE', diff);
		text = editorContainer.innerText;
	}
});

document.getElementById("join").onclick = () =>
{
	if (!connected)
	{
		username = document.getElementById("username").value;
		if (username)
		{
			socket.emit("COMM_JOIN", createUser(username));
			connected = true;
			editorContainer.setAttribute("contenteditable", true);
			status.innerText = "Connected";
		}
	}
};
document.getElementById("leave").onclick = () =>
{
	if (connected)
	{
		socket.emit("COMM_LEAVE");
		connected = false;
		editorContainer.setAttribute("contenteditable", false);
		status.innerText = "Disconnected";
	}
};

editorContainer.addEventListener('mousemove', (event) =>
{
	if (connected)
	{
		socket.emit('COMM_CURSOR', { x: event.clientX, y: event.clientY });
	}
});