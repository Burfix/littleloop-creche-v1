const roleTabs = document.querySelectorAll(".role-tab");
const navItems = document.querySelectorAll(".nav-item");
const screens = document.querySelectorAll(".screen");
const screenTitle = document.querySelector("#screen-title");
const toast = document.querySelector("#toast");

const parentTimeline = [
  { time: "07:41", title: "Checked in", meta: "Signed by Mom at the front gate" },
  { time: "09:10", title: "Breakfast", meta: "Ate most of porridge and fruit" },
  { time: "10:15", title: "Activity", meta: "Painting shapes with the Blue Room" },
  { time: "12:05", title: "Lunch", meta: "Finished pasta, skipped carrots" },
  { time: "13:02", title: "Nap started", meta: "Settled quickly after story time" },
];

const teacherActions = [
  { label: "Attendance", detail: "Mark class roll" },
  { label: "Meal", detail: "Log food and amount" },
  { label: "Nap", detail: "Start or stop timer" },
  { label: "Photo", detail: "Capture and tag" },
  { label: "Incident", detail: "Record and notify" },
  { label: "Summary", detail: "Send day note" },
];

const roleDefaults = {
  parent: {
    title: "Mila is in care",
    nav: [
      ["Home", "parent-home"],
      ["Moments", "parent-moments"],
      ["Billing", "parent-billing"],
      ["Chat", "parent-chat"],
    ],
    screen: "parent-home",
  },
  teacher: {
    title: "Blue Room cockpit",
    nav: [
      ["Class", "teacher-home"],
      ["Capture", "teacher-home"],
      ["Queue", "teacher-home"],
      ["Parents", "teacher-home"],
    ],
    screen: "teacher-home",
  },
  owner: {
    title: "Owner dashboard",
    nav: [
      ["Overview", "owner-home"],
      ["Billing", "owner-home"],
      ["Consent", "owner-home"],
      ["Reports", "owner-home"],
    ],
    screen: "owner-home",
  },
};

function showScreen(target) {
  screens.forEach((screen) => {
    screen.classList.toggle("active", screen.dataset.screen === target);
  });
  navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.target === target);
  });
}

function setRole(role) {
  const config = roleDefaults[role];
  screenTitle.textContent = config.title;

  roleTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.role === role);
  });

  navItems.forEach((item, index) => {
    const navConfig = config.nav[index];
    item.textContent = navConfig[0];
    item.dataset.target = navConfig[1];
  });

  showScreen(config.screen);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2200);
}

document.querySelector("#parent-timeline").innerHTML = parentTimeline
  .map(
    (event) => `
      <article class="timeline-item">
        <time>${event.time}</time>
        <div>
          <strong>${event.title}</strong>
          <span>${event.meta}</span>
        </div>
      </article>
    `
  )
  .join("");

document.querySelector("#teacher-actions").innerHTML = teacherActions
  .map(
    (action) => `
      <button class="teacher-action" data-action="${action.label}">
        <strong>${action.label}</strong>
        <span>${action.detail}</span>
      </button>
    `
  )
  .join("");

roleTabs.forEach((tab) => {
  tab.addEventListener("click", () => setRole(tab.dataset.role));
});

navItems.forEach((item) => {
  item.addEventListener("click", () => showScreen(item.dataset.target));
});

document.querySelectorAll(".teacher-action").forEach((button) => {
  button.addEventListener("click", () => {
    showToast(`${button.dataset.action} saved to today's timeline`);
  });
});

document.querySelectorAll(".primary-action").forEach((button) => {
  button.addEventListener("click", () => {
    showToast("Payment flow ready for PayFast, EFT, or manual receipt");
  });
});
