// Ashtatic Internet Solution - Custom Cyberpunk Toast & Dialog System

/**
 * Pastikan Container Toast Ada di DOM
 */
function getOrCreateToastContainer() {
  let container = document.getElementById("ashtatic-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "ashtatic-toast-container";
    container.className = "fixed top-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none max-w-sm w-full px-4 sm:px-0";
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Menampilkan Toast Notifikasi Kustom
 * @param {string} message - Pesan notifikasi
 * @param {'success'|'error'|'warning'|'info'} type - Tipe notifikasi
 * @param {number} duration - Durasi tampil dalam milidetik (default: 3500)
 */
export function showToast(message, type = "info", duration = 3500) {
  const container = getOrCreateToastContainer();

  const toast = document.createElement("div");
  toast.className = `pointer-events-auto transform transition-all duration-300 ease-out translate-y-[-10px] opacity-0 flex items-start gap-3 p-4 rounded-2xl backdrop-blur-xl shadow-2xl border ${getToastStyle(type)}`;

  let icon = "fa-circle-info text-cyan-400";
  if (type === "success") icon = "fa-circle-check text-emerald-400";
  if (type === "error") icon = "fa-triangle-exclamation text-rose-400";
  if (type === "warning") icon = "fa-bell text-amber-400";

  toast.innerHTML = `
    <div class="text-xl shrink-0 mt-0.5">
      <i class="fa-solid ${icon}"></i>
    </div>
    <div class="flex-grow text-xs sm:text-sm text-slate-100 font-medium leading-relaxed pr-2">
      ${message}
    </div>
    <button class="text-slate-400 hover:text-white shrink-0 p-1 rounded-md transition text-xs">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  const closeBtn = toast.querySelector("button");
  closeBtn.addEventListener("click", () => dismissToast(toast));

  container.appendChild(toast);

  // Trigger animasi masuk
  requestAnimationFrame(() => {
    toast.classList.remove("translate-y-[-10px]", "opacity-0");
    toast.classList.add("translate-y-0", "opacity-100");
  });

  // Auto dismiss
  const timer = setTimeout(() => {
    dismissToast(toast);
  }, duration);

  function dismissToast(el) {
    clearTimeout(timer);
    el.classList.add("opacity-0", "translate-x-8");
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 300);
  }
}

function getToastStyle(type) {
  switch (type) {
    case "success":
      return "bg-[#061814]/95 border-emerald-500/60 shadow-[0_0_25px_rgba(16,185,129,0.3)]";
    case "error":
      return "bg-[#1f080e]/95 border-rose-500/60 shadow-[0_0_25px_rgba(244,63,94,0.3)]";
    case "warning":
      return "bg-[#1f1606]/95 border-amber-500/60 shadow-[0_0_25px_rgba(245,158,11,0.3)]";
    case "info":
    default:
      return "bg-[#06112a]/95 border-cyan-500/60 shadow-[0_0_25px_rgba(0,240,255,0.3)]";
  }
}

/**
 * Menampilkan Custom Alert Modal
 */
export function showCustomAlert(title, message, type = "info") {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "fixed inset-0 z-[9999] flex items-center justify-center p-4 modal-backdrop animate-fade-in";

    let iconColor = "text-cyan-400 border-cyan-400/40 bg-cyan-950/60";
    let icon = "fa-circle-info";
    let btnClass = "btn-neon-cyan";

    if (type === "success") {
      iconColor = "text-emerald-400 border-emerald-400/40 bg-emerald-950/60";
      icon = "fa-circle-check";
      btnClass = "bg-emerald-500 hover:bg-emerald-400 text-black";
    } else if (type === "error") {
      iconColor = "text-rose-400 border-rose-400/40 bg-rose-950/60";
      icon = "fa-triangle-exclamation";
      btnClass = "bg-rose-500 hover:bg-rose-400 text-white";
    }

    backdrop.innerHTML = `
      <div class="relative w-full max-w-sm bg-[#091129] border border-cyan-500/40 rounded-3xl p-6 shadow-2xl text-center space-y-4 transform transition-all scale-95 opacity-0 animate-scale-up">
        <div class="w-14 h-14 mx-auto rounded-2xl border flex items-center justify-center text-2xl ${iconColor}">
          <i class="fa-solid ${icon}"></i>
        </div>
        <h4 class="text-xl font-bold text-white">${title}</h4>
        <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">${message}</p>
        <button id="alertOkBtn" class="w-full py-3 rounded-xl ${btnClass} text-xs font-bold uppercase tracking-wider transition">
          Mengerti
        </button>
      </div>
    `;

    document.body.appendChild(backdrop);

    const modalBox = backdrop.querySelector("div");
    requestAnimationFrame(() => {
      modalBox.classList.remove("scale-95", "opacity-0");
      modalBox.classList.add("scale-100", "opacity-100");
    });

    const okBtn = backdrop.querySelector("#alertOkBtn");
    okBtn.addEventListener("click", () => {
      backdrop.remove();
      resolve(true);
    });
  });
}

/**
 * Menampilkan Custom Confirm Modal
 */
export function showCustomConfirm(title, message, confirmBtnText = "Ya, Lanjutkan", cancelBtnText = "Batal") {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "fixed inset-0 z-[9999] flex items-center justify-center p-4 modal-backdrop animate-fade-in";

    backdrop.innerHTML = `
      <div class="relative w-full max-w-sm bg-[#091129] border border-red-500/50 rounded-3xl p-6 shadow-2xl text-center space-y-4">
        <div class="w-14 h-14 mx-auto rounded-2xl border border-red-500/40 bg-red-950/60 flex items-center justify-center text-red-400 text-2xl">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
        <h4 class="text-xl font-bold text-white">${title}</h4>
        <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">${message}</p>
        <div class="flex items-center gap-3 pt-2">
          <button id="confirmCancelBtn" class="w-1/2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition">
            ${cancelBtnText}
          </button>
          <button id="confirmYesBtn" class="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold uppercase tracking-wider transition shadow-lg">
            ${confirmBtnText}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const yesBtn = backdrop.querySelector("#confirmYesBtn");
    const cancelBtn = backdrop.querySelector("#confirmCancelBtn");

    yesBtn.addEventListener("click", () => {
      backdrop.remove();
      resolve(true);
    });

    cancelBtn.addEventListener("click", () => {
      backdrop.remove();
      resolve(false);
    });
  });
}
