const initialState = {
  activeRole: "parent",
  activeScreen: "parent-home",
  timeline: [
    { time: "07:41", title: "Checked in", meta: "Signed by Mom at the front gate", type: "check" },
    { time: "09:10", title: "Breakfast", meta: "Ate most of porridge and fruit", type: "meal" },
    { time: "10:15", title: "Painting shapes", meta: "Photo verified by Teacher Naledi", type: "photo" },
    { time: "12:05", title: "Lunch", meta: "Finished pasta, skipped carrots", type: "meal" },
    { time: "13:02", title: "Nap started", meta: "Settled quickly after story time", type: "nap" },
  ],
  moments: ["Painting shapes", "Lunch finished", "Garden play", "Nap time"],
  receipts: [
    ["April fees", "Paid R1,850"],
    ["March fees", "Paid R1,850"],
    ["Registration", "Paid R600"],
  ],
  chat: [
    ["teacher", "Mila ate most of lunch and asked for more water."],
    ["parent", "Thank you. Please keep her sunhat on outside."],
    ["teacher", "Done. It is in her cubby for pickup."],
  ],
  invoicePaid: false,
  remindersSent: false,
};

const pebblestonesClasses = [
  ["3 months-1 year", 16, 2],
  ["1-2 yr", 18, 2],
  ["2-3 yr", 18, 2],
  ["3-4 yr", 17, 2],
  ["4-5 yr", 19, 2],
];

let state = loadState();

const roleTabs = document.querySelectorAll(".role-tab");
const navItems = document.querySelectorAll(".nav-item");
const screens = document.querySelectorAll(".screen");
const screenTitle = document.querySelector("#screen-title");
const toast = document.querySelector("#toast");
const loginPanel = document.querySelector("#login-panel");
const appPanel = document.querySelector("#app-panel");

const roleConfig = {
  parent: {
    title: "Pebblestones parent",
    screen: "parent-home",
    nav: [
      ["Home", "parent-home"],
      ["Moments", "parent-moments"],
      ["Billing", "parent-billing"],
      ["Chat", "parent-chat"],
    ],
  },
  teacher: {
    title: "Pebblestones teacher",
    screen: "teacher-home",
    nav: [
      ["Class", "teacher-home"],
      ["Capture", "teacher-home"],
      ["Queue", "teacher-home"],
      ["Parents", "teacher-home"],
    ],
  },
  owner: {
    title: "Pebblestones owner",
    screen: "owner-home",
    nav: [
      ["Overview", "owner-home"],
      ["Billing", "owner-home"],
      ["Consent", "owner-home"],
      ["Reports", "owner-home"],
    ],
  },
};

const teacherActions = [
  ["Breakfast", "Ate most of breakfast", "meal"],
  ["Nap ended", "Slept 1h 20m and woke happy", "nap"],
  ["Photo moment", "Garden play photo verified", "photo"],
  ["Incident", "Minor bump logged, parent notified", "incident"],
  ["Pickup", "Grandmother approved for pickup", "check"],
  ["Summary", "Day summary sent to guardians", "note"],
];

function loadState() {
  const saved = localStorage.getItem("littleloop-demo");
  return saved ? JSON.parse(saved) : structuredClone(initialState);
}

function saveState() {
  localStorage.setItem("littleloop-demo", JSON.stringify(state));
}

function nowTime() {
  return new Date().toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

function render() {
  renderRole();
  renderTimeline();
  renderMoments();
  renderBilling();
  renderChat();
  renderTeacher();
  renderOwner();
  showScreen(state.activeScreen);
  saveState();
}

function renderRole() {
  const config = roleConfig[state.activeRole];
  screenTitle.textContent = config.title;

  roleTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.role === state.activeRole));
  navItems.forEach((item, index) => {
    item.textContent = config.nav[index][0];
    item.dataset.target = config.nav[index][1];
    item.classList.toggle("active", item.dataset.target === state.activeScreen);
  });
}

function renderTimeline() {
  document.querySelector("#parent-timeline").innerHTML = state.timeline
    .map(
      (event) => `
        <article class="timeline-item ${event.type}">
          <time>${event.time}</time>
          <div>
            <strong>${event.title}</strong>
            <span>${event.meta}</span>
          </div>
        </article>
      `
    )
    .join("");
  document.querySelector("#timeline-count").textContent = `${state.timeline.length} items`;
  document.querySelector("#parent-summary").textContent =
    state.timeline.some((event) => event.type === "incident")
      ? "Mila has one new care note."
      : "Mila is safe and settled.";
}

function renderMoments() {
  const classes = ["art", "lunch", "play", "nap", "craft", "outside"];
  document.querySelector("#moment-grid").innerHTML = state.moments
    .map((moment, index) => `<article class="moment-tile ${classes[index % classes.length]}"><span>${moment}</span></article>`)
    .join("");
  document.querySelector("#moment-count").textContent = `${state.moments.length} saved`;
}

function renderBilling() {
  document.querySelector("#invoice-amount").textContent = state.invoicePaid ? "R0 due" : "R1,850 due";
  document.querySelector("#invoice-status").textContent = state.invoicePaid
    ? "Proof uploaded. Awaiting owner confirmation."
    : "Due 25 May 2026";
  document.querySelector("#pay-demo").textContent = state.invoicePaid ? "Proof uploaded" : "Mark proof uploaded";
  document.querySelector("#receipt-list").innerHTML = state.receipts
    .map(([title, meta]) => `<article><strong>${title}</strong><span>${meta}</span></article>`)
    .join("");
  document.querySelector("#receipt-count").textContent = `${state.receipts.length} receipts`;
}

function renderChat() {
  document.querySelector("#chat-thread").innerHTML = state.chat
    .map(([sender, message]) => `<p class="message ${sender}">${message}</p>`)
    .join("");
}

function renderTeacher() {
  document.querySelector("#teacher-actions").innerHTML = teacherActions
    .map(
      ([title, detail, type]) => `
        <button class="teacher-action" data-title="${title}" data-detail="${detail}" data-type="${type}">
          <strong>${title}</strong>
          <span>${detail}</span>
        </button>
      `
    )
    .join("");

  document.querySelector("#teacher-queue").innerHTML = [
    ["Verify photo tags", `${state.moments.length} parent-visible moments`],
    ["Pickup records", "3 QR signatures waiting"],
    ["Daily summary", "Auto-draft ready"],
  ]
    .map(([title, meta]) => `<article><strong>${title}</strong><span>${meta}</span></article>`)
    .join("");
}

function renderOwner() {
  document.querySelector("#outstanding-stat").textContent = state.invoicePaid ? "R7,050" : "R8,900";
  document.querySelector("#family-stat").textContent = state.remindersSent ? "Reminders sent" : "7 families";
  document.querySelector("#class-list").innerHTML = pebblestonesClasses
    .map(
      ([name, children, teachers]) => `
        <article>
          <div>
            <strong>${name}</strong>
            <span>${teachers} teachers assigned</span>
          </div>
          <em>${children}/20</em>
        </article>
      `
    )
    .join("");
}

function setRole(role) {
  state.activeRole = role;
  state.activeScreen = roleConfig[role].screen;
  loginPanel.classList.add("hidden");
  appPanel.classList.remove("hidden");
  render();
}

function showScreen(target) {
  state.activeScreen = target;
  screens.forEach((screen) => screen.classList.toggle("active", screen.dataset.screen === target));
  navItems.forEach((item) => item.classList.toggle("active", item.dataset.target === target));
  saveState();
}

function addTimeline(title, meta, type) {
  state.timeline.unshift({ time: nowTime(), title, meta, type });
  if (type === "photo") state.moments.unshift(title);
  showToast(`${title} added to parent timeline`);
  render();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2200);
}

document.querySelectorAll("[data-login]").forEach((button) => {
  button.addEventListener("click", () => setRole(button.dataset.login));
});

roleTabs.forEach((tab) => tab.addEventListener("click", () => setRole(tab.dataset.role)));
navItems.forEach((item) => item.addEventListener("click", () => showScreen(item.dataset.target)));

document.querySelector("#teacher-actions").addEventListener("click", (event) => {
  const button = event.target.closest(".teacher-action");
  if (!button) return;
  addTimeline(button.dataset.title, button.dataset.detail, button.dataset.type);
});

document.querySelector("#pay-demo").addEventListener("click", () => {
  state.invoicePaid = true;
  showToast("Payment proof uploaded for owner review");
  render();
});

document.querySelector("#chat-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.querySelector("#chat-input");
  const value = input.value.trim();
  if (!value) return;
  state.chat.push(["parent", value]);
  input.value = "";
  showToast("Message added to demo thread");
  render();
});

document.querySelector(".owner-actions").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const action = button.dataset.ownerAction;
  if (action === "reminder") state.remindersSent = true;
  showToast(button.querySelector("strong").textContent);
  render();
});

document.querySelector("#reset-demo").addEventListener("click", () => {
  state = structuredClone(initialState);
  localStorage.removeItem("littleloop-demo");
  loginPanel.classList.remove("hidden");
  appPanel.classList.add("hidden");
  screenTitle.textContent = "Pebblestones parent";
  showToast("Demo reset");
});

render();
