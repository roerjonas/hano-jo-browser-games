(() => {
  "use strict";

  const SHAPES = ["square", "triangle", "circle"];
  const SHAPE_NAMES = {
    square: "Quadrat",
    triangle: "Dreieck",
    circle: "Kreis",
  };
  const SHAPE_SVG = {
    square: '<svg viewBox="0 0 60 60"><rect x="10" y="10" width="40" height="40" rx="4"/></svg>',
    triangle: '<svg viewBox="0 0 60 60"><polygon points="30,8 54,52 6,52"/></svg>',
    circle: '<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="22"/></svg>',
  };

  const scoreEl = document.getElementById("score");
  const streakEl = document.getElementById("streak");
  const bestEl = document.getElementById("best");
  const hintEl = document.getElementById("hint");
  const resultEl = document.getElementById("result");
  const shapeBtns = Array.from(document.querySelectorAll(".shape-btn"));
  const doorEls = Array.from(document.querySelectorAll(".door"));

  let doorShapes = [];      // shape hidden behind each door
  let selectedShape = null; // player's current guess
  let score = 0;
  let streak = 0;
  let best = Number(localStorage.getItem("doors_best") || 0);
  let locked = false;       // true while a round result is showing

  bestEl.textContent = best;

  // Fisher–Yates shuffle of the three shapes across the three doors
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function newRound() {
    doorShapes = shuffle(SHAPES);
    selectedShape = null;
    locked = false;

    shapeBtns.forEach((b) => b.classList.remove("selected"));

    doorEls.forEach((door) => {
      door.classList.remove("open", "correct", "wrong", "locked");
      const reveal = door.querySelector(".door-reveal");
      reveal.innerHTML = "";
      reveal.removeAttribute("data-shape");
    });

    resultEl.textContent = " ";
    resultEl.className = "result";
    hintEl.textContent = "Wähle eine Form — und dann eine Tür!";
  }

  function selectShape(shape, btn) {
    if (locked) return;
    selectedShape = shape;
    shapeBtns.forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    hintEl.textContent = "Gut! Hinter welcher Tür steckt das " + SHAPE_NAMES[shape] + "?";
  }

  function openDoor(door) {
    if (locked) return;

    if (!selectedShape) {
      hintEl.textContent = "Erst eine Form wählen! ☝️";
      shapeBtns.forEach((b) => {
        b.animate(
          [{ transform: "translateY(0)" }, { transform: "translateY(-6px)" }, { transform: "translateY(0)" }],
          { duration: 260 }
        );
      });
      return;
    }

    locked = true;
    doorEls.forEach((d) => d.classList.add("locked"));

    const idx = Number(door.dataset.door);
    const actual = doorShapes[idx];
    const win = actual === selectedShape;

    // reveal the shape behind the chosen door
    const reveal = door.querySelector(".door-reveal");
    reveal.setAttribute("data-shape", actual);
    reveal.innerHTML = SHAPE_SVG[actual];
    door.classList.add("open", win ? "correct" : "wrong");

    if (win) {
      score++;
      streak++;
      if (streak > best) {
        best = streak;
        localStorage.setItem("doors_best", String(best));
        bestEl.textContent = best;
      }
      scoreEl.textContent = score;
      streakEl.textContent = streak;
      resultEl.textContent = "Richtig! Du darfst durch! 🎉";
      resultEl.className = "result good";
      hintEl.textContent = " ";
    } else {
      streak = 0;
      streakEl.textContent = streak;
      resultEl.textContent =
        "Leider falsch — dahinter war ein " + SHAPE_NAMES[actual] + ".";
      resultEl.className = "result bad";
      hintEl.textContent = " ";
    }

    setTimeout(newRound, win ? 1250 : 1900);
  }

  shapeBtns.forEach((btn) => {
    btn.addEventListener("click", () => selectShape(btn.dataset.shape, btn));
  });

  doorEls.forEach((door) => {
    door.addEventListener("click", () => openDoor(door));
  });

  newRound();
})();
