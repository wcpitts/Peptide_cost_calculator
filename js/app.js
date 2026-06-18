(function () {
  "use strict";

  var aminoAcids = window.AMINO_ACIDS || [];
  var aminoByCode = aminoAcids.reduce(function (map, amino) {
    map[amino.code] = amino;
    return map;
  }, {});
  var standardCodes = new Set(aminoAcids.map(function (amino) {
    return amino.code;
  }));

  var form = document.getElementById("requestForm");
  var sequenceInput = document.getElementById("peptideSequence");
  var scaleInput = document.getElementById("synthesisScale");
  var equivalentsInput = document.getElementById("couplingEquivalents");
  var overagePercentInput = document.getElementById("overagePercent");
  var couplingModeInput = document.getElementById("couplingMode");
  var washOptionInput = document.getElementById("washOption");
  var customWashField = document.getElementById("customWashField");
  var customWashCountInput = document.getElementById("customWashCount");
  var nTerminusInput = document.getElementById("nTerminus");
  var cTerminusInput = document.getElementById("cTerminus");
  var aaTableBody = document.getElementById("aaTableBody");
  var reagentTableBody = document.getElementById("reagentTableBody");
  var compositionTableBody = document.getElementById("compositionTableBody");
  var compositionSummary = document.getElementById("compositionSummary");
  var reviewSummary = document.getElementById("reviewSummary");
  var sequenceValidation = document.getElementById("sequenceValidation");
  var positionSelectorPanel = document.getElementById("positionSelectorPanel");
  var sequencePositionList = document.getElementById("sequencePositionList");
  var reagentConfigNotice = document.getElementById("reagentConfigNotice");
  var methodChargeInputs = Array.from(document.querySelectorAll("[data-method-charge]"));
  var calculationValidation = document.getElementById("calculationValidation");
  var reviewValidation = document.getElementById("reviewValidation");
  var draftStatus = document.getElementById("draftStatus");
  var requesterEmailInput = document.getElementById("requesterEmail");
  var piEmailInput = document.getElementById("piEmail");
  var acknowledgmentInputs = Array.from(document.querySelectorAll("[data-acknowledgment]"));
  var requesterValidation = document.getElementById("requesterValidation");
  var costTotalCard = document.querySelector(".cost-total");
  var draftKey = "libertyBluePeptideRequestDraft";
  var reagentConfigKey = "libertyBlueReagentConfig";

  // Hematian Lab reagent configuration. Every zero default is CONFIGURATION REQUIRED.
  const reagentConfig = {
    dmfLitersPerCouplingAtPointOneMmol: 0, // CONFIGURATION REQUIRED
    dmfLitersPerDeprotectionAtPointOneMmol: 0, // CONFIGURATION REQUIRED
    dmfLitersPerWashAtPointOneMmol: 0, // CONFIGURATION REQUIRED
    pyrrolidineSolutionLitersPerDeprotectionAtPointOneMmol: 0, // CONFIGURATION REQUIRED
    dmfPricePerLiter: 0, // CONFIGURATION REQUIRED
    pyrrolidineSolutionPricePerLiter: 0 // CONFIGURATION REQUIRED
  };

  // Method-related charges are configurable demonstration fields and default to zero.
  // Wash-attributable DMF cost is calculated from reagent settings and is already included in Total DMF cost.
  const methodChargeDefaults = {
    additionalWashCycles: 0,
    additionalDoubleCouplingCycles: 0,
    otherOrContingency: 0
  };

  var reagentConfigLabels = {
    dmfLitersPerCouplingAtPointOneMmol: "DMF volume per coupling cycle at 0.10 mmol",
    dmfLitersPerDeprotectionAtPointOneMmol: "DMF volume per deprotection cycle at 0.10 mmol",
    dmfLitersPerWashAtPointOneMmol: "DMF volume per wash at 0.10 mmol",
    pyrrolidineSolutionLitersPerDeprotectionAtPointOneMmol: "Pyrrolidine solution volume per deprotection at 0.10 mmol",
    dmfPricePerLiter: "DMF price per liter",
    pyrrolidineSolutionPricePerLiter: "Pyrrolidine solution price per liter"
  };

  var latestAnalysis = null;
  var latestRequirements = null;
  var latestReagentEstimate = null;
  var latestRequestSummary = null;
  var standardRowState = {};
  var selectedPositions = new Set();
  var customRows = [];
  var customRowCounter = 0;
  var adminReagentConfig = Object.assign({}, reagentConfig);
  var clearConfirmationPending = false;
  var latestTotals = {
    aminoAcids: 0,
    reagents: 0,
    methodCharges: 0,
    requesterSuppliedAminoAcids: 0,
    dmf: 0,
    pyrrolidine: 0,
    total: 0,
    isIncomplete: false
  };

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value).replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
      }[character];
    });
  }

  function asNumber(value, fallback) {
    var parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function positiveNumber(field, fallback) {
    var value = asNumber(field.value, fallback);
    if (value <= 0) {
      return fallback;
    }
    return value;
  }

  function nonnegativeNumber(field, fallback) {
    var value = asNumber(field.value, fallback);
    if (value < 0) {
      field.value = "0";
      return 0;
    }
    return value;
  }

  function money(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(value);
  }

  function fixed(value, digits) {
    return Number.isFinite(value) ? value.toFixed(digits) : "0";
  }

  function liters(value) {
    return Number.isFinite(value) ? fixed(value, 3) + " L" : "Unavailable";
  }

  function getConfiguredReagentConfig() {
    return Object.assign({}, reagentConfig, adminReagentConfig);
  }

  function reagentConfigIsComplete(config) {
    return Object.keys(reagentConfig).every(function (key) {
      return asNumber(config[key], 0) > 0;
    });
  }

  function missingReagentConfigLabels(config) {
    return Object.keys(reagentConfig).filter(function (key) {
      return asNumber(config[key], 0) <= 0;
    }).map(function (key) {
      return reagentConfigLabels[key];
    });
  }

  function loadReagentConfig() {
    var saved = localStorage.getItem(reagentConfigKey);
    if (!saved) {
      return;
    }

    try {
      var parsed = JSON.parse(saved);
      Object.keys(reagentConfig).forEach(function (key) {
        adminReagentConfig[key] = Math.max(0, asNumber(parsed[key], reagentConfig[key]));
      });
    } catch (error) {
      localStorage.removeItem(reagentConfigKey);
    }
  }

  function getMethodCharges() {
    var doubleCouplingCharge = asNumber(document.getElementById("methodDoubleCouplingCharge").value, methodChargeDefaults.additionalDoubleCouplingCycles);
    var contingencyCharge = asNumber(document.getElementById("methodContingencyCharge").value, methodChargeDefaults.otherOrContingency);
    doubleCouplingCharge = Number.isFinite(doubleCouplingCharge) && doubleCouplingCharge >= 0 ? doubleCouplingCharge : 0;
    contingencyCharge = Number.isFinite(contingencyCharge) && contingencyCharge >= 0 ? contingencyCharge : 0;

    return {
      additionalWashCycles: 0,
      additionalDoubleCouplingCycles: doubleCouplingCharge,
      otherOrContingency: contingencyCharge,
      total: doubleCouplingCharge + contingencyCharge
    };
  }

  function emptyRequirements(customRequirementRows) {
    return {
      standardRows: [],
      customRows: customRequirementRows || [],
      allRows: customRequirementRows || [],
      totals: {
        uniqueCount: 0,
        totalMass: 0,
        labMass: 0,
        requesterMass: 0,
        labSubtotal: 0
      }
    };
  }

  function setValidationState(element, messages, validMessage) {
    if (!element) {
      return;
    }

    element.classList.remove("is-valid", "is-invalid");
    if (messages.length) {
      element.textContent = messages.join(" ");
      element.classList.add("is-invalid");
    } else {
      element.textContent = validMessage || "";
      if (validMessage) {
        element.classList.add("is-valid");
      }
    }
  }

  function validateBaseCalculationInputs(analysis, settings) {
    var messages = [];

    if (!analysis.validation.hasResidues) {
      messages.push("Enter a peptide sequence before calculating requirements.");
    } else if (!analysis.validation.isValid) {
      messages.push("Correct invalid sequence symbols before calculating requirements.");
    }

    if (!Number.isFinite(settings.scale) || settings.scale <= 0) {
      messages.push("Synthesis scale must be a positive mmol value.");
    }

    if (!Number.isFinite(settings.equivalents) || settings.equivalents <= 0) {
      messages.push("Coupling equivalents must be positive.");
    }

    if (!Number.isFinite(settings.overagePercent) || settings.overagePercent < 0) {
      messages.push("Overage must be zero or a positive percentage.");
    }

    if (settings.washOption === "custom" && (!Number.isFinite(settings.customWashCount) || settings.customWashCount < 0)) {
      messages.push("Custom wash count must be zero or a positive whole number.");
    }

    return messages;
  }

  function validateMethodCharges() {
    var messages = [];
    methodChargeInputs.forEach(function (input) {
      var value = asNumber(input.value, NaN);
      if (!Number.isFinite(value) || value < 0) {
        messages.push((input.labels && input.labels[0] ? input.labels[0].textContent : "Method charge") + " must be zero or positive.");
      }
    });
    return messages;
  }

  function validateRequirementRows(requirements) {
    var messages = [];
    requirements.customRows.forEach(function (row) {
      if (!row.validation.isValid) {
        messages.push("Complete nonstandard amino-acid row " + row.id.replace("custom-", "") + ": " + row.validation.errors.join(", ") + ".");
      }
    });
    return messages;
  }

  function validateCalculationState(analysis, settings, requirements) {
    var messages = validateBaseCalculationInputs(analysis, settings);
    messages = messages.concat(validateMethodCharges());
    if (requirements) {
      messages = messages.concat(validateRequirementRows(requirements));
    }

    return {
      isValid: messages.length === 0,
      messages: messages
    };
  }

  function uniqueValues(values) {
    return Array.from(new Set(values));
  }

  function normalizeSequence(input) {
    var originalSequence = String(input || "");
    var compactSequence = originalSequence.replace(/\s+/g, "");
    var parserSequence = compactSequence.toUpperCase().replace(/\u2082/g, "2");

    return {
      originalSequence: originalSequence,
      compactSequence: compactSequence,
      parserSequence: parserSequence
    };
  }

  function detectTerminalGroups(normalizedInput) {
    var sequence = normalizedInput.parserSequence;
    var nTerminus = {
      value: "free",
      label: "free amine",
      token: "none"
    };
    var cTerminus = {
      value: "acid",
      label: "carboxylic acid",
      token: "none"
    };

    if (sequence.indexOf("AC-") === 0) {
      nTerminus = {
        value: "acetylated",
        label: "acetylated",
        token: "Ac-"
      };
      sequence = sequence.slice(3);
    } else if (sequence.indexOf("H-") === 0) {
      nTerminus = {
        value: "free",
        label: "free amine",
        token: "H-"
      };
      sequence = sequence.slice(2);
    }

    if (sequence.slice(-4) === "-NH2") {
      cTerminus = {
        value: "amide",
        label: "amide",
        token: "-NH2"
      };
      sequence = sequence.slice(0, -4);
    } else if (sequence.slice(-3) === "-OH") {
      cTerminus = {
        value: "acid",
        label: "carboxylic acid",
        token: "-OH"
      };
      sequence = sequence.slice(0, -3);
    }

    return {
      normalizedSequence: sequence,
      nTerminus: nTerminus,
      cTerminus: cTerminus
    };
  }

  function validateSequence(sequence) {
    var invalidDetails = [];

    Array.from(sequence).forEach(function (symbol, index) {
      if (!standardCodes.has(symbol)) {
        invalidDetails.push({
          symbol: symbol,
          position: index + 1
        });
      }
    });

    return {
      hasResidues: sequence.length > 0,
      isValid: sequence.length > 0 && invalidDetails.length === 0,
      invalidDetails: invalidDetails,
      invalidSymbols: uniqueValues(invalidDetails.map(function (detail) {
        return detail.symbol;
      }))
    };
  }

  function countAminoAcids(sequence) {
    var counts = {};
    aminoAcids.forEach(function (amino) {
      counts[amino.code] = 0;
    });

    Array.from(sequence).forEach(function (symbol) {
      if (counts[symbol] !== undefined) {
        counts[symbol] += 1;
      }
    });

    return counts;
  }

  function mapSequencePositions(sequence) {
    var positions = {};
    aminoAcids.forEach(function (amino) {
      positions[amino.code] = [];
    });

    Array.from(sequence).forEach(function (symbol, index) {
      if (positions[symbol]) {
        positions[symbol].push(index + 1);
      }
    });

    return positions;
  }

  function calculateAminoAcidPercentages(counts, length) {
    var percentages = {};
    aminoAcids.forEach(function (amino) {
      percentages[amino.code] = length ? (counts[amino.code] / length) * 100 : 0;
    });

    return percentages;
  }

  function analyzeSequence(input) {
    var normalized = normalizeSequence(input);
    var terminalInfo = detectTerminalGroups(normalized);
    var validation = validateSequence(terminalInfo.normalizedSequence);
    var calculationSequence = validation.isValid ? terminalInfo.normalizedSequence : "";
    var counts = countAminoAcids(calculationSequence);
    var positions = mapSequencePositions(calculationSequence);
    var percentages = calculateAminoAcidPercentages(counts, calculationSequence.length);

    return {
      originalSequence: normalized.originalSequence,
      compactSequence: normalized.compactSequence,
      normalizedSequence: terminalInfo.normalizedSequence,
      calculationSequence: calculationSequence,
      nTerminus: terminalInfo.nTerminus,
      cTerminus: terminalInfo.cTerminus,
      validation: validation,
      length: calculationSequence.length,
      counts: counts,
      positions: positions,
      percentages: percentages
    };
  }

  function calculateMass(analysis) {
    var sequence = analysis.calculationSequence;
    if (!sequence.length) {
      return 0;
    }

    var residueTotal = Array.from(sequence).reduce(function (sum, symbol) {
      return sum + (aminoByCode[symbol] ? aminoByCode[symbol].residueMass : 0);
    }, 18.02);

    if (analysis.nTerminus.value === "acetylated") {
      residueTotal += 42.04;
    }

    if (analysis.cTerminus.value === "amide") {
      residueTotal -= 0.98;
    }

    return residueTotal;
  }

  function getSettings() {
    var washOption = washOptionInput.value;
    var customWashValue = asNumber(customWashCountInput.value, NaN);
    var customWashCount = Number.isFinite(customWashValue) ? Math.max(0, Math.round(customWashValue)) : NaN;
    var scale = asNumber(scaleInput.value, NaN);
    var equivalents = asNumber(equivalentsInput.value, NaN);
    var overagePercent = asNumber(overagePercentInput.value, NaN);

    if (washOption !== "custom") {
      customWashCount = 0;
    }

    return {
      scale: scale,
      equivalents: equivalents,
      overagePercent: overagePercent,
      overageMultiplier: Number.isFinite(overagePercent) && overagePercent >= 0 ? 1 + overagePercent / 100 : NaN,
      couplingMode: couplingModeInput.value,
      washOption: washOption,
      customWashCount: customWashCount
    };
  }

  function sourceOptions(selectedSource) {
    return [
      { value: "lab", label: "Hematian Lab stock" },
      { value: "requester", label: "Requester-supplied" }
    ].map(function (option) {
      return "<option value=\"" + option.value + "\"" + (option.value === selectedSource ? " selected" : "") + ">" + option.label + "</option>";
    }).join("");
  }

  function getStandardState(code) {
    if (!standardRowState[code]) {
      standardRowState[code] = {
        source: "lab",
        gramsOverride: null,
        selectedForDouble: false
      };
    }
    return standardRowState[code];
  }

  function theoreticalRequirement(molecularWeight, cycles, equivalents, settings) {
    var totalEquivalents = equivalents * cycles;
    var requiredMmol = settings.scale * totalEquivalents * settings.overageMultiplier;
    var requiredGrams = requiredMmol * molecularWeight / 1000;

    return {
      totalEquivalents: totalEquivalents,
      requiredMmol: requiredMmol,
      requiredGrams: requiredGrams
    };
  }

  function selectedPositionCountFor(code, positions) {
    return positions.filter(function (position) {
      return selectedPositions.has(position);
    }).length;
  }

  function standardCyclesFor(amino, count, positions, settings, state) {
    var additionalCycles = 0;

    if (settings.couplingMode === "double-all") {
      additionalCycles = count;
    } else if (settings.couplingMode === "selected-residue" && state.selectedForDouble) {
      additionalCycles = count;
    } else if (settings.couplingMode === "selected-position") {
      additionalCycles = selectedPositionCountFor(amino.code, positions);
    }

    return count + additionalCycles;
  }

  function validateCustomRow(row) {
    var errors = [];
    var molecularWeight = asNumber(row.molecularWeight, NaN);
    var occurrences = asNumber(row.occurrences, NaN);
    var equivalents = asNumber(row.equivalents, NaN);
    var cycles = asNumber(row.cycles, NaN);
    var unitPrice = asNumber(row.unitPrice, NaN);

    if (!String(row.abbreviation || "").trim()) {
      errors.push("abbreviation is required");
    }
    if (!String(row.buildingBlock || "").trim()) {
      errors.push("building-block name is required");
    }
    if (!Number.isFinite(molecularWeight) || molecularWeight <= 0) {
      errors.push("molecular weight must be positive");
    }
    if (!Number.isFinite(occurrences) || occurrences <= 0) {
      errors.push("occurrences must be positive");
    }
    if (!Number.isFinite(equivalents) || equivalents <= 0) {
      errors.push("coupling equivalents must be positive");
    }
    if (!Number.isFinite(cycles) || cycles <= 0) {
      errors.push("coupling cycles must be positive");
    }
    if (row.source === "lab" && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
      errors.push("unit price must be zero or positive");
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
      molecularWeight: molecularWeight,
      occurrences: occurrences,
      equivalents: equivalents,
      cycles: cycles,
      unitPrice: Number.isFinite(unitPrice) ? Math.max(unitPrice, 0) : 0
    };
  }

  function buildStandardRows(analysis, settings) {
    if (!analysis.validation.isValid) {
      return [];
    }

    return aminoAcids.filter(function (amino) {
      return analysis.counts[amino.code] > 0;
    }).map(function (amino) {
      var state = getStandardState(amino.code);
      var count = analysis.counts[amino.code];
      var positions = analysis.positions[amino.code] || [];
      var cycles = standardCyclesFor(amino, count, positions, settings, state);
      var requirement = theoreticalRequirement(amino.molecularWeight, cycles, settings.equivalents, settings);
      var displayGrams = state.gramsOverride === null ? requirement.requiredGrams : state.gramsOverride;
      var source = state.source || "lab";
      var cost = source === "lab" ? displayGrams * amino.pricePerGram : 0;

      return {
        type: "standard",
        code: amino.code,
        amino: amino,
        count: count,
        positions: positions,
        equivalents: settings.equivalents,
        cycles: cycles,
        totalEquivalents: requirement.totalEquivalents,
        requiredMmol: requirement.requiredMmol,
        theoreticalGrams: requirement.requiredGrams,
        displayGrams: displayGrams,
        source: source,
        unitPrice: amino.pricePerGram,
        estimatedCost: cost,
        isManual: state.gramsOverride !== null,
        isSelectedForDouble: state.selectedForDouble
      };
    });
  }

  function buildCustomRequirementRows(settings) {
    return customRows.map(function (row) {
      var validation = validateCustomRow(row);
      var requirement = validation.isValid
        ? theoreticalRequirement(validation.molecularWeight, validation.cycles, validation.equivalents, settings)
        : { totalEquivalents: 0, requiredMmol: 0, requiredGrams: 0 };
      var displayGrams = row.gramsOverride === null ? requirement.requiredGrams : row.gramsOverride;
      var cost = validation.isValid && row.source === "lab" ? displayGrams * validation.unitPrice : 0;

      return {
        type: "custom",
        id: row.id,
        sourceRow: row,
        validation: validation,
        code: row.abbreviation,
        buildingBlock: row.buildingBlock,
        molecularWeight: validation.molecularWeight,
        count: validation.occurrences,
        equivalents: validation.equivalents,
        cycles: validation.cycles,
        totalEquivalents: requirement.totalEquivalents,
        requiredMmol: requirement.requiredMmol,
        theoreticalGrams: requirement.requiredGrams,
        displayGrams: displayGrams,
        source: row.source,
        unitPrice: validation.unitPrice,
        estimatedCost: cost,
        isManual: row.gramsOverride !== null
      };
    });
  }

  function buildRequirements(analysis, settings) {
    var standardRows = buildStandardRows(analysis, settings);
    var customRequirementRows = buildCustomRequirementRows(settings);
    var allIncludedRows = standardRows.concat(customRequirementRows.filter(function (row) {
      return row.validation.isValid;
    }));
    var totals = allIncludedRows.reduce(function (accumulator, row) {
      accumulator.totalMass += row.displayGrams;
      if (row.source === "lab") {
        accumulator.labMass += row.displayGrams;
        accumulator.labSubtotal += row.estimatedCost;
      } else {
        accumulator.requesterMass += row.displayGrams;
      }
      return accumulator;
    }, {
      uniqueCount: allIncludedRows.length,
      totalMass: 0,
      labMass: 0,
      requesterMass: 0,
      labSubtotal: 0
    });

    return {
      standardRows: standardRows,
      customRows: customRequirementRows,
      allRows: standardRows.concat(customRequirementRows),
      totals: totals
    };
  }

  function renderPositionSelector(analysis, settings) {
    selectedPositions = new Set(Array.from(selectedPositions).filter(function (position) {
      return position >= 1 && position <= analysis.length;
    }));

    if (settings.couplingMode !== "selected-position" || !analysis.validation.isValid) {
      positionSelectorPanel.classList.add("is-hidden");
      sequencePositionList.innerHTML = "";
      return;
    }

    positionSelectorPanel.classList.remove("is-hidden");
    sequencePositionList.innerHTML = Array.from(analysis.calculationSequence).map(function (symbol, index) {
      var position = index + 1;
      var id = "position-" + position;
      return (
        "<label class=\"position-choice\" for=\"" + id + "\">" +
          "<input id=\"" + id + "\" type=\"checkbox\" data-position=\"" + position + "\"" + (selectedPositions.has(position) ? " checked" : "") + ">" +
          "<span>" + position + " " + symbol + "</span>" +
        "</label>"
      );
    }).join("");
  }

  function renderAminoAcidRows(requirements, settings) {
    var rows = [];

    requirements.standardRows.forEach(function (row) {
      var selectionEnabled = settings.couplingMode === "selected-residue";
      var selectionChecked = settings.couplingMode === "double-all" || (selectionEnabled && row.isSelectedForDouble);
      var displayGrams = row.isManual ? row.displayGrams : row.theoreticalGrams;

      rows.push(
        "<tr data-row-code=\"" + row.code + "\">" +
          "<td class=\"selection-cell\">" +
            "<input type=\"checkbox\" data-double-code=\"" + row.code + "\" aria-label=\"Double-couple " + row.amino.name + "\"" +
              (selectionChecked ? " checked" : "") +
              (selectionEnabled ? "" : " disabled") + ">" +
          "</td>" +
          "<td><span class=\"aa-symbol\">" + row.code + "</span></td>" +
          "<td><strong>" + escapeHtml(row.amino.buildingBlock) + "</strong><div class=\"row-note\">" + escapeHtml(row.amino.name) + "</div></td>" +
          "<td class=\"calculated-cell\">" + fixed(row.amino.molecularWeight, 2) + "</td>" +
          "<td class=\"calculated-cell\">" + row.count + "</td>" +
          "<td class=\"calculated-cell\">" + fixed(row.equivalents, 2) + "</td>" +
          "<td class=\"calculated-cell\">" + row.cycles + "</td>" +
          "<td class=\"calculated-cell\">" + fixed(row.totalEquivalents, 3) + "</td>" +
          "<td class=\"calculated-cell\">" + fixed(row.requiredMmol, 3) + "</td>" +
          "<td>" +
            "<label class=\"sr-only\" for=\"grams-" + row.code + "\">Amount required in grams for " + row.amino.name + "</label>" +
            "<input class=\"table-input grams-input" + (row.isManual ? " manual-edited" : "") + "\" id=\"grams-" + row.code + "\" type=\"number\" min=\"0\" step=\"0.001\" value=\"" + fixed(displayGrams, 3) + "\" data-grams-code=\"" + row.code + "\" data-display-grams=\"" + fixed(row.theoreticalGrams, 3) + "\">" +
            (row.isManual ? "<span class=\"manual-badge\">Manual</span><div class=\"row-note\">Theory: " + fixed(row.theoreticalGrams, 6) + " g</div>" : "") +
          "</td>" +
          "<td>" +
            "<label class=\"sr-only\" for=\"source-" + row.code + "\">Source for " + row.amino.name + "</label>" +
            "<select id=\"source-" + row.code + "\" data-source-code=\"" + row.code + "\">" + sourceOptions(row.source) + "</select>" +
            (row.source === "requester" ? "<div class=\"row-note approval-note\">Requester-supplied amino acids require approval.</div>" : "") +
          "</td>" +
          "<td class=\"calculated-cell\">" + fixed(row.unitPrice, 2) + "</td>" +
          "<td class=\"calculated-cell\">" + money(row.estimatedCost) + "</td>" +
          "<td><button class=\"mini-button\" type=\"button\" data-reset-override-code=\"" + row.code + "\"" + (row.isManual ? "" : " disabled") + ">Reset</button></td>" +
        "</tr>"
      );
    });

    requirements.customRows.forEach(function (row) {
      rows.push(renderCustomRow(row));
    });

    if (!rows.length) {
      rows.push(
        "<tr>" +
          "<td colspan=\"14\">Analyze a valid peptide sequence or add a nonstandard amino acid to calculate requirements.</td>" +
        "</tr>"
      );
    }

    aaTableBody.innerHTML = rows.join("");
  }

  function renderCustomRow(row) {
    var sourceRow = row.sourceRow;
    var isValid = row.validation.isValid;
    var displayGrams = row.isManual ? row.displayGrams : row.theoreticalGrams;
    var validationNote = isValid ? "" : "<div class=\"row-note row-warning\">Missing or invalid: " + escapeHtml(row.validation.errors.join(", ")) + ".</div>";

    return (
      "<tr class=\"custom-row" + (isValid ? "" : " is-invalid-row") + "\" data-custom-id=\"" + row.id + "\">" +
        "<td class=\"selection-cell\"><span class=\"row-note\">Custom</span></td>" +
        "<td>" +
          "<label class=\"sr-only\" for=\"custom-code-" + row.id + "\">Custom abbreviation</label>" +
          "<input class=\"table-input\" id=\"custom-code-" + row.id + "\" type=\"text\" value=\"" + escapeHtml(sourceRow.abbreviation) + "\" data-custom-id=\"" + row.id + "\" data-custom-field=\"abbreviation\">" +
        "</td>" +
        "<td>" +
          "<label class=\"sr-only\" for=\"custom-block-" + row.id + "\">Custom building-block name</label>" +
          "<input class=\"table-input wide-input\" id=\"custom-block-" + row.id + "\" type=\"text\" value=\"" + escapeHtml(sourceRow.buildingBlock) + "\" data-custom-id=\"" + row.id + "\" data-custom-field=\"buildingBlock\">" +
          validationNote +
        "</td>" +
        "<td>" +
          "<label class=\"sr-only\" for=\"custom-mw-" + row.id + "\">Custom molecular weight</label>" +
          "<input class=\"table-input\" id=\"custom-mw-" + row.id + "\" type=\"number\" min=\"0.0001\" step=\"0.01\" value=\"" + escapeHtml(sourceRow.molecularWeight) + "\" data-custom-id=\"" + row.id + "\" data-custom-field=\"molecularWeight\">" +
        "</td>" +
        "<td>" +
          "<label class=\"sr-only\" for=\"custom-count-" + row.id + "\">Custom occurrence count</label>" +
          "<input class=\"table-input\" id=\"custom-count-" + row.id + "\" type=\"number\" min=\"0.0001\" step=\"1\" value=\"" + escapeHtml(sourceRow.occurrences) + "\" data-custom-id=\"" + row.id + "\" data-custom-field=\"occurrences\">" +
        "</td>" +
        "<td>" +
          "<label class=\"sr-only\" for=\"custom-eq-" + row.id + "\">Custom coupling equivalents</label>" +
          "<input class=\"table-input\" id=\"custom-eq-" + row.id + "\" type=\"number\" min=\"0.0001\" step=\"0.1\" value=\"" + escapeHtml(sourceRow.equivalents) + "\" data-custom-id=\"" + row.id + "\" data-custom-field=\"equivalents\">" +
        "</td>" +
        "<td>" +
          "<label class=\"sr-only\" for=\"custom-cycles-" + row.id + "\">Custom coupling cycles</label>" +
          "<input class=\"table-input\" id=\"custom-cycles-" + row.id + "\" type=\"number\" min=\"0.0001\" step=\"1\" value=\"" + escapeHtml(sourceRow.cycles) + "\" data-custom-id=\"" + row.id + "\" data-custom-field=\"cycles\">" +
        "</td>" +
        "<td class=\"calculated-cell\">" + fixed(row.totalEquivalents, 3) + "</td>" +
        "<td class=\"calculated-cell\">" + fixed(row.requiredMmol, 3) + "</td>" +
        "<td>" +
          "<label class=\"sr-only\" for=\"custom-grams-" + row.id + "\">Custom required grams</label>" +
          "<input class=\"table-input grams-input" + (row.isManual ? " manual-edited" : "") + "\" id=\"custom-grams-" + row.id + "\" type=\"number\" min=\"0\" step=\"0.001\" value=\"" + fixed(displayGrams, 3) + "\" data-custom-id=\"" + row.id + "\" data-custom-grams=\"true\" data-display-grams=\"" + fixed(row.theoreticalGrams, 3) + "\">" +
          (row.isManual ? "<span class=\"manual-badge\">Manual</span><div class=\"row-note\">Theory: " + fixed(row.theoreticalGrams, 6) + " g</div>" : "") +
        "</td>" +
        "<td>" +
          "<label class=\"sr-only\" for=\"custom-source-" + row.id + "\">Custom source</label>" +
          "<select id=\"custom-source-" + row.id + "\" data-custom-id=\"" + row.id + "\" data-custom-field=\"source\">" + sourceOptions(sourceRow.source) + "</select>" +
          (sourceRow.source === "requester" ? "<div class=\"row-note approval-note\">Requester-supplied amino acids require approval.</div>" : "") +
        "</td>" +
        "<td>" +
          "<label class=\"sr-only\" for=\"custom-price-" + row.id + "\">Custom unit price</label>" +
          "<input class=\"table-input\" id=\"custom-price-" + row.id + "\" type=\"number\" min=\"0\" step=\"0.01\" value=\"" + escapeHtml(sourceRow.unitPrice) + "\" data-custom-id=\"" + row.id + "\" data-custom-field=\"unitPrice\">" +
        "</td>" +
        "<td class=\"calculated-cell\">" + money(row.estimatedCost) + "</td>" +
        "<td><button class=\"mini-button danger-button\" type=\"button\" data-delete-custom-id=\"" + row.id + "\">Delete</button></td>" +
      "</tr>"
    );
  }

  function updateRequirementTotals(requirements) {
    setText("totalUniqueAminoAcids", requirements.totals.uniqueCount);
    setText("labAminoAcidSubtotal", money(requirements.totals.labSubtotal));
  }

  function resinCost(settings, sequenceLength) {
    return sequenceLength ? settings.scale * 275 : 0;
  }

  function validCustomRequirementRows(requirements) {
    return requirements.customRows.filter(function (row) {
      return row.validation.isValid;
    });
  }

  function getWashCycles(baseResidueCount, settings) {
    if (!baseResidueCount) {
      return 0;
    }

    if (settings.washOption === "standard") {
      return baseResidueCount * 2;
    }

    if (settings.washOption === "custom") {
      return baseResidueCount * settings.customWashCount;
    }

    return 0;
  }

  function calculateReagentCycles(analysis, requirements, settings) {
    var customRequirementRows = validCustomRequirementRows(requirements);
    var standardCouplingCycles = requirements.standardRows.reduce(function (sum, row) {
      return sum + row.cycles;
    }, 0);
    var customCouplingCycles = customRequirementRows.reduce(function (sum, row) {
      return sum + row.cycles;
    }, 0);
    var standardOccurrences = requirements.standardRows.reduce(function (sum, row) {
      return sum + row.count;
    }, 0);
    var customOccurrences = customRequirementRows.reduce(function (sum, row) {
      return sum + row.count;
    }, 0);
    var totalCouplingCycles = standardCouplingCycles + customCouplingCycles;
    var totalResidueOccurrences = standardOccurrences + customOccurrences;

    return {
      totalCouplingCycles: totalCouplingCycles,
      totalDeprotectionCycles: totalResidueOccurrences,
      additionalDoubleCouplings: Math.max(totalCouplingCycles - totalResidueOccurrences, 0),
      washCycles: getWashCycles(totalResidueOccurrences, settings),
      standardCouplingCycles: standardCouplingCycles,
      customCouplingCycles: customCouplingCycles
    };
  }

  function calculateReagentEstimate(analysis, requirements, settings) {
    var config = getConfiguredReagentConfig();
    var cycles = calculateReagentCycles(analysis, requirements, settings);
    var scaleFactor = settings.scale / 0.1;
    var missingConfig = missingReagentConfigLabels(config);
    var configIsComplete = missingConfig.length === 0;
    var isConfigured = analysis.length > 0 && configIsComplete;
    var volumes = {
      dmfCouplingLiters: 0,
      dmfDeprotectionLiters: 0,
      dmfWashLiters: 0,
      totalDmfLiters: 0,
      pyrrolidineDeprotectionLiters: 0
    };
    var costs = {
      dmfCost: 0,
      pyrrolidineCost: 0,
      totalCost: 0
    };

    if (isConfigured) {
      volumes.dmfCouplingLiters = config.dmfLitersPerCouplingAtPointOneMmol * cycles.totalCouplingCycles * scaleFactor;
      volumes.dmfDeprotectionLiters = config.dmfLitersPerDeprotectionAtPointOneMmol * cycles.totalDeprotectionCycles * scaleFactor;
      volumes.dmfWashLiters = config.dmfLitersPerWashAtPointOneMmol * cycles.washCycles * scaleFactor;
      volumes.totalDmfLiters = volumes.dmfCouplingLiters + volumes.dmfDeprotectionLiters + volumes.dmfWashLiters;
      volumes.pyrrolidineDeprotectionLiters = config.pyrrolidineSolutionLitersPerDeprotectionAtPointOneMmol * cycles.totalDeprotectionCycles * scaleFactor;
      costs.dmfCost = volumes.totalDmfLiters * config.dmfPricePerLiter;
      costs.pyrrolidineCost = volumes.pyrrolidineDeprotectionLiters * config.pyrrolidineSolutionPricePerLiter;
      costs.totalCost = costs.dmfCost + costs.pyrrolidineCost;
    }

    return {
      config: config,
      configIsComplete: configIsComplete,
      missingConfig: missingConfig,
      isConfigured: isConfigured,
      scaleFactor: scaleFactor,
      cycles: cycles,
      volumes: volumes,
      costs: costs
    };
  }

  function emptyReagentEstimate() {
    var config = getConfiguredReagentConfig();
    var missingConfig = missingReagentConfigLabels(config);
    return {
      config: config,
      configIsComplete: missingConfig.length === 0,
      missingConfig: missingConfig,
      isConfigured: false,
      scaleFactor: 0,
      cycles: {
        totalCouplingCycles: 0,
        totalDeprotectionCycles: 0,
        additionalDoubleCouplings: 0,
        washCycles: 0,
        standardCouplingCycles: 0,
        customCouplingCycles: 0
      },
      volumes: {
        dmfCouplingLiters: 0,
        dmfDeprotectionLiters: 0,
        dmfWashLiters: 0,
        totalDmfLiters: 0,
        pyrrolidineDeprotectionLiters: 0
      },
      costs: {
        dmfCost: 0,
        pyrrolidineCost: 0,
        totalCost: 0
      }
    };
  }

  function reagentCost(reagentEstimate) {
    return reagentEstimate && reagentEstimate.isConfigured ? reagentEstimate.costs.totalCost : 0;
  }

  function configDisplay(value) {
    return asNumber(value, 0) > 0 ? money(value) + " / L" : "CONFIGURATION REQUIRED";
  }

  function volumeDisplay(reagentEstimate, value) {
    return reagentEstimate.isConfigured ? liters(value) : "CONFIGURATION REQUIRED";
  }

  function costDisplay(reagentEstimate, value) {
    return reagentEstimate.isConfigured ? money(value) : "Config required";
  }

  function calculateWashCostBreakdown(settings, reagentEstimate) {
    var config = reagentEstimate && reagentEstimate.config ? reagentEstimate.config : getConfiguredReagentConfig();
    var cycles = reagentEstimate && reagentEstimate.cycles ? reagentEstimate.cycles : { washCycles: 0 };
    var effectiveWashCount = Number.isFinite(cycles.washCycles) ? cycles.washCycles : 0;
    var scaleFactor = reagentEstimate && Number.isFinite(reagentEstimate.scaleFactor) && reagentEstimate.scaleFactor > 0
      ? reagentEstimate.scaleFactor
      : (Number.isFinite(settings.scale) && settings.scale > 0 ? settings.scale / 0.1 : 0);
    var requiredKeys = [
      "dmfLitersPerWashAtPointOneMmol",
      "dmfPricePerLiter"
    ];
    var missingConfiguration = effectiveWashCount > 0 ? requiredKeys.filter(function (key) {
      return asNumber(config[key], 0) <= 0;
    }).map(function (key) {
      return reagentConfigLabels[key];
    }) : [];
    var isConfigured = missingConfiguration.length === 0;
    var dmfLiters = isConfigured
      ? effectiveWashCount * config.dmfLitersPerWashAtPointOneMmol * scaleFactor
      : null;
    var dmfCost = isConfigured ? dmfLiters * config.dmfPricePerLiter : null;

    return {
      washOption: washDescription(settings),
      effectiveWashCount: effectiveWashCount,
      dmfLiters: dmfLiters,
      dmfCost: dmfCost,
      isConfigured: isConfigured,
      missingConfiguration: missingConfiguration
    };
  }

  function washAmountDisplay(washBreakdown) {
    return washBreakdown.isConfigured ? liters(washBreakdown.dmfLiters) : "Configuration required";
  }

  function washCostDisplay(washBreakdown) {
    return washBreakdown.isConfigured ? money(washBreakdown.dmfCost) : "Configuration required";
  }

  function renderReagentRows(reagentEstimate) {
    var config = reagentEstimate.config;
    var rows = [
      {
        reagent: "DMF",
        role: "Coupling, deprotection, and washes",
        volume: reagentEstimate.volumes.totalDmfLiters,
        unitPrice: config.dmfPricePerLiter,
        cost: reagentEstimate.costs.dmfCost
      },
      {
        reagent: "Pyrrolidine solution",
        role: "Deprotection",
        volume: reagentEstimate.volumes.pyrrolidineDeprotectionLiters,
        unitPrice: config.pyrrolidineSolutionPricePerLiter,
        cost: reagentEstimate.costs.pyrrolidineCost
      }
    ].map(function (row) {
      return (
        "<tr>" +
          "<td><strong>" + escapeHtml(row.reagent) + "</strong></td>" +
          "<td>" + escapeHtml(row.role) + "</td>" +
          "<td class=\"calculated-cell\">" + volumeDisplay(reagentEstimate, row.volume) + "</td>" +
          "<td class=\"calculated-cell\">" + configDisplay(row.unitPrice) + "</td>" +
          "<td class=\"calculated-cell\">" + costDisplay(reagentEstimate, row.cost) + "</td>" +
        "</tr>"
      );
    });

    reagentTableBody.innerHTML = rows.join("");
  }

  function updateReagentBreakdown(reagentEstimate) {
    var unavailableMessage = "DMF and pyrrolidine estimates are unavailable until the Hematian Lab configures instrument-specific reagent-use values.";
    var configuredMessage = "DMF and pyrrolidine estimates use the Hematian Lab administrator configuration stored in this browser.";
    var cycles = reagentEstimate.cycles;

    reagentConfigNotice.textContent = reagentEstimate.isConfigured ? configuredMessage : unavailableMessage;
    setText("dmfCouplingVolume", reagentEstimate.isConfigured ? liters(reagentEstimate.volumes.dmfCouplingLiters) : "Unavailable");
    setText("dmfDeprotectionVolume", reagentEstimate.isConfigured ? liters(reagentEstimate.volumes.dmfDeprotectionLiters) : "Unavailable");
    setText("dmfWashVolume", reagentEstimate.isConfigured ? liters(reagentEstimate.volumes.dmfWashLiters) : "Unavailable");
    setText("dmfTotalVolume", reagentEstimate.isConfigured ? liters(reagentEstimate.volumes.totalDmfLiters) : "Unavailable");
    setText("pyrrolidineDeprotectionVolume", reagentEstimate.isConfigured ? liters(reagentEstimate.volumes.pyrrolidineDeprotectionLiters) : "Unavailable");
    setText(
      "reagentCycleSummary",
      cycles.totalCouplingCycles + " coupling / " +
      cycles.totalDeprotectionCycles + " deprotection / " +
      cycles.washCycles + " wash; " +
      cycles.additionalDoubleCouplings + " additional double-coupling cycle(s)"
    );
  }

  function renderCompositionSummary(analysis) {
    if (!analysis.validation.isValid) {
      compositionSummary.textContent = analysis.validation.hasResidues
        ? "Composition is paused until unsupported symbols are corrected."
        : "Analyze a valid sequence to view composition.";
      return;
    }

    var pills = aminoAcids.filter(function (amino) {
      return analysis.counts[amino.code] > 0;
    }).map(function (amino) {
      return (
        "<span class=\"composition-pill\">" +
          amino.code + ": " +
          analysis.counts[amino.code] + " (" +
          fixed(analysis.percentages[amino.code], 1) + "%)" +
        "</span>"
      );
    });

    compositionSummary.innerHTML = pills.join("");
  }

  function renderCompositionTable(analysis) {
    var rows = aminoAcids.map(function (amino) {
      var positions = analysis.positions[amino.code] || [];
      return (
        "<tr>" +
          "<td><span class=\"aa-symbol\">" + amino.code + "</span></td>" +
          "<td>" + amino.name + "</td>" +
          "<td>" + amino.buildingBlock + "</td>" +
          "<td>" + (analysis.counts[amino.code] || 0) + "</td>" +
          "<td>" + fixed(analysis.percentages[amino.code] || 0, 1) + "%</td>" +
          "<td>" + (positions.length ? positions.join(", ") : "-") + "</td>" +
        "</tr>"
      );
    });

    compositionTableBody.innerHTML = rows.join("");
  }

  function setText(id, value) {
    var element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  function formatInvalidDetails(details) {
    return details.map(function (detail) {
      return detail.symbol + " at position " + detail.position;
    }).join(", ");
  }

  function updateValidationMessage(analysis) {
    sequenceValidation.classList.remove("is-valid", "is-invalid");

    if (!analysis.validation.hasResidues) {
      sequenceValidation.textContent = "Enter a peptide sequence to analyze.";
      return;
    }

    if (!analysis.validation.isValid) {
      sequenceValidation.textContent = "Invalid symbols: " + formatInvalidDetails(analysis.validation.invalidDetails) + ".";
      sequenceValidation.classList.add("is-invalid");
      return;
    }

    sequenceValidation.textContent = "Sequence accepted. Terminal labels were detected and removed from the normalized residue sequence.";
    sequenceValidation.classList.add("is-valid");
  }

  function syncTerminalControls(analysis) {
    nTerminusInput.value = analysis.nTerminus.value;
    cTerminusInput.value = analysis.cTerminus.value;
  }

  function updateMetrics(analysis) {
    var status = document.getElementById("analysisStatus");
    var warnings = document.getElementById("sequenceWarnings");
    var normalizedDisplay = analysis.normalizedSequence || "None";

    setText("metricOriginalSequence", analysis.originalSequence || "None");
    setText("metricNormalizedSequence", normalizedDisplay);
    setText("metricLength", analysis.length + " aa");
    setText("metricNTerminus", analysis.nTerminus.label);
    setText("metricCTerminus", analysis.cTerminus.label);
    setText("metricMass", fixed(calculateMass(analysis), 1) + " Da");

    status.classList.remove("has-warning", "has-error");

    if (!analysis.validation.hasResidues) {
      status.textContent = "Waiting";
      status.classList.add("has-warning");
      warnings.textContent = "Add a peptide sequence to calculate requirements.";
      return;
    }

    if (!analysis.validation.isValid) {
      status.textContent = "Invalid";
      status.classList.add("has-error");
      warnings.textContent = "Unsupported symbols in normalized sequence: " + formatInvalidDetails(analysis.validation.invalidDetails) + ".";
      return;
    }

    status.textContent = "Analyzed";
    warnings.textContent = "No unsupported one-letter amino-acid codes detected.";
  }

  function updateCosts(requirements, analysis, settings, reagentEstimate) {
    var reagents = reagentCost(reagentEstimate);
    var methodCharges = getMethodCharges();
    var washBreakdown = calculateWashCostBreakdown(settings, reagentEstimate);
    var totalAminoAcidCost = requirements.totals.labSubtotal;
    var total = totalAminoAcidCost + reagents + methodCharges.total;
    var hasSequence = analysis.length > 0;
    var isIncomplete = hasSequence && !reagentEstimate.configIsComplete;
    var missingConfigText = reagentEstimate.missingConfig.length
      ? "Missing configuration: " + reagentEstimate.missingConfig.join("; ") + "."
      : "";

    latestTotals = {
      aminoAcids: totalAminoAcidCost,
      reagents: reagents,
      methodCharges: methodCharges.total,
      requesterSuppliedAminoAcids: 0,
      dmf: reagentEstimate.isConfigured ? reagentEstimate.costs.dmfCost : 0,
      pyrrolidine: reagentEstimate.isConfigured ? reagentEstimate.costs.pyrrolidineCost : 0,
      washAssociatedDmfLiters: washBreakdown.isConfigured ? washBreakdown.dmfLiters : null,
      washAssociatedDmfCost: washBreakdown.isConfigured ? washBreakdown.dmfCost : null,
      total: total,
      isIncomplete: isIncomplete
    };

    if (costTotalCard) {
      costTotalCard.classList.toggle("is-incomplete", isIncomplete);
    }

    setText("estimateTotalLabel", isIncomplete ? "Incomplete preliminary estimate" : "Estimated total");
    setText("estimatedTotal", isIncomplete ? "Incomplete preliminary estimate" : money(total));
    setText(
      "estimatedTotalDetail",
      isIncomplete
        ? "Partial total without configured DMF/pyrrolidine: " + money(total)
        : (hasSequence ? "Updates as sequence, sourcing, reagent, and method inputs change." : "Awaiting a valid sequence.")
    );

    setText("aminoAcidCost", money(requirements.totals.labSubtotal));
    setText("costRequesterMass", fixed(requirements.totals.requesterMass, 3) + " g");
    setText("costRequesterSubtotal", money(0));
    setText("costAminoAcidTotal", money(totalAminoAcidCost));
    setText("costDmfAmount", reagentEstimate.isConfigured ? liters(reagentEstimate.volumes.totalDmfLiters) : "Configuration required");
    setText("costDmfCost", reagentEstimate.isConfigured ? money(reagentEstimate.costs.dmfCost) : "Configuration required");
    setText("costDmfCouplingAmount", reagentEstimate.isConfigured ? liters(reagentEstimate.volumes.dmfCouplingLiters) : "Configuration required");
    setText("costDmfDeprotectionAmount", reagentEstimate.isConfigured ? liters(reagentEstimate.volumes.dmfDeprotectionLiters) : "Configuration required");
    setText("costDmfWashAmount", reagentEstimate.isConfigured ? liters(reagentEstimate.volumes.dmfWashLiters) : "Configuration required");
    setText("costDmfTotalBreakdownAmount", reagentEstimate.isConfigured ? liters(reagentEstimate.volumes.totalDmfLiters) : "Configuration required");
    setText("costPyrrolidineAmount", reagentEstimate.isConfigured ? liters(reagentEstimate.volumes.pyrrolidineDeprotectionLiters) : "Config required");
    setText("costPyrrolidineCost", reagentEstimate.isConfigured ? money(reagentEstimate.costs.pyrrolidineCost) : "Config required");
    setText("costWashOption", washBreakdown.washOption);
    setText("costWashCount", String(washBreakdown.effectiveWashCount));
    setText("costWashDmfAmount", washAmountDisplay(washBreakdown));
    setText("costWashDmfCost", washCostDisplay(washBreakdown));
    setText("methodChargeSubtotal", money(methodCharges.total));
    setText("missingReagentConfig", isIncomplete ? missingConfigText : "");

    var requesterRows = requirements.allRows.filter(function (row) {
      return row.source === "requester" && (row.type === "standard" || row.validation.isValid);
    }).length;
    var note = "This is a preliminary estimate. Final cost will be determined from the approved method and actual reagent use.";
    if (!hasSequence) {
      note += " Enter a valid sequence and analyze it to update the estimate.";
    }
    if (isIncomplete) {
      note += " " + missingConfigText;
    }
    if (requesterRows) {
      note += " " + requesterRows + " requester-supplied row(s) are currently set to $0.00.";
    }
    setText("estimateNote", note);
  }

  function updateConditionalSettings(settings) {
    if (settings.washOption === "custom") {
      customWashField.classList.remove("is-hidden");
    } else {
      customWashField.classList.add("is-hidden");
    }
  }

  function validateRequesterInformation() {
    if (!requesterValidation) {
      return true;
    }

    var invalidEmails = [];
    [
      { field: requesterEmailInput, label: "Institutional email" },
      { field: piEmailInput, label: "PI email" }
    ].forEach(function (item) {
      if (item.field && item.field.value && !item.field.checkValidity()) {
        invalidEmails.push(item.label);
      }
    });

    var missingAcknowledgments = acknowledgmentInputs.filter(function (input) {
      return !input.checked;
    }).length;

    requesterValidation.classList.remove("is-valid", "is-invalid");

    if (invalidEmails.length) {
      requesterValidation.textContent = "Check email format for: " + invalidEmails.join(", ") + ".";
      requesterValidation.classList.add("is-invalid");
      return false;
    }

    if (missingAcknowledgments) {
      requesterValidation.textContent = missingAcknowledgments + " required acknowledgment(s) remaining.";
      return false;
    }

    requesterValidation.textContent = "Requester information acknowledgments are complete for local review.";
    requesterValidation.classList.add("is-valid");
    return true;
  }

  function updateDashboard() {
    var analysis = analyzeSequence(sequenceInput.value);
    var settings = getSettings();
    var baseMessages = validateBaseCalculationInputs(analysis, settings);
    var requirements = baseMessages.length ? emptyRequirements() : buildRequirements(analysis, settings);
    var calculationState = validateCalculationState(analysis, settings, requirements);
    var displayRequirements = requirements;
    var costRequirements = calculationState.isValid ? requirements : emptyRequirements(requirements.customRows);
    var reagentEstimate = calculationState.isValid ? calculateReagentEstimate(analysis, requirements, settings) : emptyReagentEstimate();

    latestAnalysis = analysis;
    latestRequirements = costRequirements;
    latestReagentEstimate = reagentEstimate;
    syncTerminalControls(analysis);
    updateConditionalSettings(settings);
    renderPositionSelector(analysis, settings);
    updateValidationMessage(analysis);
    updateMetrics(analysis);
    renderCompositionSummary(analysis);
    renderCompositionTable(analysis);
    renderAminoAcidRows(displayRequirements, settings);
    updateRequirementTotals(costRequirements);
    renderReagentRows(reagentEstimate);
    updateReagentBreakdown(reagentEstimate);
    updateCosts(costRequirements, analysis, settings, reagentEstimate);
    setValidationState(calculationValidation, calculationState.messages, "Calculation inputs are ready.");
    if (!calculationState.isValid) {
      setText("estimateTotalLabel", "Calculation paused");
      setText("estimatedTotal", "Resolve validation issues");
      setText("estimatedTotalDetail", calculationState.messages.join(" "));
      setText("estimateNote", "Calculations are paused until validation issues are resolved.");
    }
    validateRequesterInformation();
  }

  function findCustomRow(id) {
    return customRows.find(function (row) {
      return row.id === id;
    });
  }

  function addCustomRow() {
    var settings = getSettings();
    customRowCounter += 1;
    customRows.push({
      id: "custom-" + customRowCounter,
      abbreviation: "",
      buildingBlock: "",
      molecularWeight: "",
      occurrences: "1",
      equivalents: fixed(settings.equivalents, 2),
      cycles: "1",
      source: "lab",
      unitPrice: "0",
      gramsOverride: null
    });
    updateDashboard();
  }

  function handleTableChange(event) {
    var target = event.target;
    var code = target.dataset.doubleCode || target.dataset.sourceCode || target.dataset.gramsCode || "";
    var customId = target.dataset.customId || "";

    if (target.dataset.doubleCode) {
      getStandardState(code).selectedForDouble = target.checked;
      updateDashboard();
      return;
    }

    if (target.dataset.sourceCode) {
      getStandardState(code).source = target.value;
      updateDashboard();
      return;
    }

    if (target.dataset.gramsCode) {
      var state = getStandardState(code);
      var value = asNumber(target.value, NaN);
      var displayValue = asNumber(target.dataset.displayGrams, NaN);
      state.gramsOverride = Number.isFinite(value) && value >= 0 && Math.abs(value - displayValue) > 0.0000001 ? value : null;
      updateDashboard();
      return;
    }

    if (target.dataset.customField) {
      var row = findCustomRow(customId);
      if (row) {
        row[target.dataset.customField] = target.value;
        if (target.dataset.customField === "source" && target.value === "requester") {
          row.unitPrice = row.unitPrice || "0";
        }
      }
      updateDashboard();
      return;
    }

    if (target.dataset.customGrams) {
      var customRow = findCustomRow(customId);
      var customValue = asNumber(target.value, NaN);
      var customDisplay = asNumber(target.dataset.displayGrams, NaN);
      if (customRow) {
        customRow.gramsOverride = Number.isFinite(customValue) && customValue >= 0 && Math.abs(customValue - customDisplay) > 0.0000001 ? customValue : null;
      }
      updateDashboard();
    }
  }

  function handleTableClick(event) {
    var resetCode = event.target.dataset.resetOverrideCode;
    var deleteCustomId = event.target.dataset.deleteCustomId;

    if (resetCode) {
      getStandardState(resetCode).gramsOverride = null;
      updateDashboard();
      return;
    }

    if (deleteCustomId) {
      customRows = customRows.filter(function (row) {
        return row.id !== deleteCustomId;
      });
      updateDashboard();
    }
  }

  function handlePositionChange(event) {
    if (!event.target.dataset.position) {
      return;
    }

    var position = Number.parseInt(event.target.dataset.position, 10);
    if (event.target.checked) {
      selectedPositions.add(position);
    } else {
      selectedPositions.delete(position);
    }
    updateDashboard();
  }

  function clearSelectedPositions() {
    selectedPositions.clear();
    updateDashboard();
  }

  function serializeForm() {
    var fields = {};
    Array.from(form.elements).forEach(function (field) {
      var key = field.name || field.id;
      if (!key || field.type === "button" || field.type === "submit") {
        return;
      }

      fields[key] = field.type === "checkbox" ? field.checked : field.value;
    });
    var analysis = latestAnalysis || analyzeSequence(sequenceInput.value);

    return {
      version: 1,
      savedAt: new Date().toISOString(),
      fields: fields,
      originalSequence: analysis.originalSequence,
      normalizedSequence: analysis.normalizedSequence,
      terminalGroups: {
        nTerminus: analysis.nTerminus,
        cTerminus: analysis.cTerminus
      },
      standardRowState: standardRowState,
      selectedPositions: Array.from(selectedPositions),
      customRows: customRows,
      customRowCounter: customRowCounter,
      methodCharges: getMethodCharges()
    };
  }

  function setDraftStatus(message, isError) {
    if (!draftStatus) {
      return;
    }
    draftStatus.classList.toggle("is-invalid", Boolean(isError));
    draftStatus.textContent = message;
  }

  function saveDraft() {
    localStorage.setItem(draftKey, JSON.stringify(serializeForm()));
    clearConfirmationPending = false;
    setDraftStatus("Draft saved locally in this browser.", false);
  }

  function normalizeDraftData(data) {
    if (!data || data.fields) {
      return data;
    }

    var stateKeys = [
      "standardRowState",
      "selectedPositions",
      "customRows",
      "customRowCounter",
      "reagentConfig",
      "methodCharges",
      "originalSequence",
      "normalizedSequence",
      "terminalGroups",
      "version",
      "savedAt"
    ];
    var fields = {};
    Object.keys(data).forEach(function (key) {
      if (stateKeys.indexOf(key) === -1) {
        fields[key] = data[key];
      }
    });

    return Object.assign({}, data, { fields: fields });
  }

  function applyDraft(data) {
    data = normalizeDraftData(data);
    if (!data || !data.fields) {
      return false;
    }

    Object.keys(data.fields).forEach(function (key) {
      var field = form.elements[key] || document.getElementById(key);
      if (!field || field.type === "button" || field.type === "submit") {
        return;
      }
      if (field.type === "checkbox") {
        field.checked = Boolean(data.fields[key]);
      } else {
        field.value = data.fields[key];
      }
    });

    standardRowState = data.standardRowState || {};
    selectedPositions = new Set(data.selectedPositions || []);
    customRows = Array.isArray(data.customRows) ? data.customRows : [];
    customRowCounter = asNumber(data.customRowCounter, customRows.length);

    clearConfirmationPending = false;
    updateDashboard();
    return true;
  }

  function loadDraft(showStatus) {
    var saved = localStorage.getItem(draftKey);
    if (!saved) {
      if (showStatus) {
        setDraftStatus("No saved draft was found in this browser.", true);
      }
      return;
    }

    try {
      var data = JSON.parse(saved);
      if (!applyDraft(data) && showStatus) {
        setDraftStatus("Saved draft could not be loaded.", true);
      } else if (showStatus) {
        setDraftStatus("Draft loaded from this browser.", false);
      }
    } catch (error) {
      localStorage.removeItem(draftKey);
      if (showStatus) {
        setDraftStatus("Saved draft was unreadable and has been removed.", true);
      }
    }
  }

  function clearForm() {
    if (!clearConfirmationPending) {
      clearConfirmationPending = true;
      setDraftStatus("Click Clear Form again to confirm clearing the form and saved draft data.", true);
      return;
    }

    form.reset();
    localStorage.removeItem(draftKey);
    sequenceInput.value = "";
    standardRowState = {};
    selectedPositions.clear();
    customRows = [];
    customRowCounter = 0;
    clearConfirmationPending = false;
    setDraftStatus("Form and saved draft data cleared.", false);
    reviewSummary.textContent = "Review details will appear here before export workflows are added.";
    updateDashboard();
  }

  function fieldValue(id) {
    var field = document.getElementById(id);
    if (field && field.tagName === "SELECT") {
      return field.value ? field.options[field.selectedIndex].text : "Not provided";
    }
    return field && field.value ? field.value : "Not provided";
  }

  function optionText(select) {
    return select.options[select.selectedIndex] ? select.options[select.selectedIndex].text : select.value;
  }

  function getCurrentRequestState() {
    var analysis = analyzeSequence(sequenceInput.value);
    var settings = getSettings();
    var baseMessages = validateBaseCalculationInputs(analysis, settings);
    var rawRequirements = baseMessages.length ? emptyRequirements() : buildRequirements(analysis, settings);
    var calculationState = validateCalculationState(analysis, settings, rawRequirements);
    var requirements = calculationState.isValid ? rawRequirements : emptyRequirements(rawRequirements.customRows);
    var reagentEstimate = calculationState.isValid ? calculateReagentEstimate(analysis, rawRequirements, settings) : emptyReagentEstimate();

    return {
      analysis: analysis,
      settings: settings,
      rawRequirements: rawRequirements,
      requirements: requirements,
      reagentEstimate: reagentEstimate,
      methodCharges: getMethodCharges(),
      calculationState: calculationState
    };
  }

  function doubleCouplingDescription(state) {
    var settings = state.settings;
    var analysis = state.analysis;
    var requirements = state.rawRequirements;

    if (settings.couplingMode === "standard") {
      return "None; standard coupling only";
    }

    if (settings.couplingMode === "double-all") {
      return "All residues";
    }

    if (settings.couplingMode === "selected-residue") {
      var residues = requirements.standardRows.filter(function (row) {
        return row.isSelectedForDouble;
      }).map(function (row) {
        return row.code + " (" + row.amino.name + ")";
      });
      return residues.length ? residues.join(", ") : "No residue types selected";
    }

    if (settings.couplingMode === "selected-position") {
      var positions = Array.from(selectedPositions).sort(function (a, b) {
        return a - b;
      }).filter(function (position) {
        return position >= 1 && position <= analysis.length;
      }).map(function (position) {
        return position + analysis.calculationSequence.charAt(position - 1);
      });
      return positions.length ? positions.join(", ") : "No sequence positions selected";
    }

    return optionText(couplingModeInput);
  }

  function washDescription(settings) {
    if (settings.washOption === "none") {
      return "No additional washes";
    }
    if (settings.washOption === "standard") {
      return "Standard washes";
    }
    return "Custom number of washes: " + settings.customWashCount;
  }

  function acknowledgmentSummary() {
    return acknowledgmentInputs.map(function (input) {
      var label = input.closest("label");
      return {
        label: label ? label.textContent.trim() : input.name,
        confirmed: input.checked
      };
    });
  }

  function requirementSummaryRows(requirements) {
    return requirements.allRows.filter(function (row) {
      return row.type === "standard" || row.validation.isValid;
    }).map(function (row) {
      return {
        code: row.code,
        protectedAminoAcid: row.type === "standard" ? row.amino.buildingBlock : row.buildingBlock,
        source: row.source === "lab" ? "Hematian Lab stock" : "Requester-supplied",
        count: row.count,
        cycles: row.cycles,
        requiredMmol: row.requiredMmol,
        grams: row.displayGrams,
        theoreticalGrams: row.theoreticalGrams,
        isManual: row.isManual,
        unitPrice: row.unitPrice,
        estimatedCost: row.estimatedCost
      };
    });
  }

  function buildRequestSummary(state) {
    var requirements = state.requirements;
    var reagentEstimate = state.reagentEstimate;
    var methodCharges = state.methodCharges;
    var washBreakdown = calculateWashCostBreakdown(state.settings, reagentEstimate);
    var total = requirements.totals.labSubtotal + reagentCost(reagentEstimate) + methodCharges.total;

    return {
      generatedAt: new Date().toISOString(),
      requester: {
        name: fieldValue("requesterName"),
        institutionalEmail: fieldValue("requesterEmail"),
        departmentOrProgram: fieldValue("departmentProgram"),
        laboratoryOrResearchGroup: fieldValue("labGroup"),
        piName: fieldValue("piName"),
        piEmail: fieldValue("piEmail"),
        requestedCompletionDate: fieldValue("targetDate"),
        firstPreferredSchedulingWindow: fieldValue("firstSchedulingWindow"),
        secondPreferredSchedulingWindow: fieldValue("secondSchedulingWindow"),
        previousAutomatedPeptideSynthesisExperience: fieldValue("synthesisExperience"),
        additionalSynthesisComments: fieldValue("requestNotes")
      },
      peptide: {
        originalSequence: state.analysis.originalSequence,
        normalizedSequence: state.analysis.normalizedSequence,
        length: state.analysis.length,
        nTerminus: state.analysis.nTerminus.label,
        cTerminus: state.analysis.cTerminus.label
      },
      synthesis: {
        scaleMmol: state.settings.scale,
        couplingEquivalents: state.settings.equivalents,
        overagePercent: state.settings.overagePercent,
        couplingMode: optionText(couplingModeInput),
        doubleCoupling: doubleCouplingDescription(state),
        washSettings: washDescription(state.settings)
      },
      aminoAcids: {
        required: requirementSummaryRows(requirements),
        requesterSupplied: requirementSummaryRows(requirements).filter(function (row) {
          return row.source === "Requester-supplied";
        }),
        hematianLab: requirementSummaryRows(requirements).filter(function (row) {
          return row.source === "Hematian Lab stock";
        }),
        totalMassGrams: requirements.totals.totalMass,
        hematianLabMassGrams: requirements.totals.labMass,
        requesterSuppliedMassGrams: requirements.totals.requesterMass,
        hematianLabSubtotal: requirements.totals.labSubtotal,
        requesterSuppliedChargedSubtotal: 0
      },
      reagents: {
        totalDmfAmountLiters: reagentEstimate.isConfigured ? reagentEstimate.volumes.totalDmfLiters : null,
        totalDmfCost: reagentEstimate.isConfigured ? reagentEstimate.costs.dmfCost : null,
        dmfCouplingAmountLiters: reagentEstimate.isConfigured ? reagentEstimate.volumes.dmfCouplingLiters : null,
        dmfDeprotectionAmountLiters: reagentEstimate.isConfigured ? reagentEstimate.volumes.dmfDeprotectionLiters : null,
        dmfWashAmountLiters: reagentEstimate.isConfigured ? reagentEstimate.volumes.dmfWashLiters : null,
        dmfAmountLiters: reagentEstimate.isConfigured ? reagentEstimate.volumes.totalDmfLiters : null,
        dmfCost: reagentEstimate.isConfigured ? reagentEstimate.costs.dmfCost : null,
        dmfAttributableToWashesLiters: washBreakdown.isConfigured ? washBreakdown.dmfLiters : null,
        dmfCostAttributableToWashes: washBreakdown.isConfigured ? washBreakdown.dmfCost : null,
        washAssociatedDmfCost: washBreakdown.isConfigured ? washBreakdown.dmfCost : null,
        washDmfIncludedInTotalDmf: true,
        pyrrolidineSolutionAmountLiters: reagentEstimate.isConfigured ? reagentEstimate.volumes.pyrrolidineDeprotectionLiters : null,
        pyrrolidineSolutionCost: reagentEstimate.isConfigured ? reagentEstimate.costs.pyrrolidineCost : null,
        missingConfiguration: reagentEstimate.missingConfig
      },
      methodEstimates: {
        washOption: washBreakdown.washOption,
        effectiveWashCount: washBreakdown.effectiveWashCount,
        dmfAttributableToWashesLiters: washBreakdown.isConfigured ? washBreakdown.dmfLiters : null,
        dmfCostAttributableToWashes: washBreakdown.isConfigured ? washBreakdown.dmfCost : null,
        additionalWashDmfLiters: washBreakdown.isConfigured ? washBreakdown.dmfLiters : null,
        washAssociatedDmfCost: washBreakdown.isConfigured ? washBreakdown.dmfCost : null,
        washValuesIncludedInTotalDmf: true,
        missingWashConfiguration: washBreakdown.missingConfiguration,
        configurableCharges: methodCharges
      },
      methodCharges: methodCharges,
      preliminaryTotal: total,
      estimateIsIncomplete: state.analysis.length > 0 && !reagentEstimate.configIsComplete,
      acknowledgments: acknowledgmentSummary()
    };
  }

  function formatRequirementLines(rows) {
    if (!rows.length) {
      return "  None";
    }
    return rows.map(function (row) {
      return "  " + row.code + " | " + row.protectedAminoAcid + " | " + row.source +
        " | count " + row.count +
        " | cycles " + row.cycles +
        " | " + fixed(row.grams, 3) + " g" +
        " | " + money(row.estimatedCost) +
        (row.isManual ? " (manual mass override)" : "");
    }).join("\n");
  }

  function formatReviewSummary(summary) {
    return [
      "Liberty Blue 2.0 - Peptide Synthesis Request Review",
      "Generated: " + summary.generatedAt,
      "",
      "Requester",
      "  Requester: " + summary.requester.name,
      "  Institutional email: " + summary.requester.institutionalEmail,
      "  Department or program: " + summary.requester.departmentOrProgram,
      "  Laboratory or research group: " + summary.requester.laboratoryOrResearchGroup,
      "  PI: " + summary.requester.piName,
      "  PI email: " + summary.requester.piEmail,
      "  Requested completion date: " + summary.requester.requestedCompletionDate,
      "  First preferred scheduling window: " + summary.requester.firstPreferredSchedulingWindow,
      "  Second preferred scheduling window: " + summary.requester.secondPreferredSchedulingWindow,
      "  Previous automated peptide-synthesis experience: " + summary.requester.previousAutomatedPeptideSynthesisExperience,
      "",
      "Peptide",
      "  Original peptide sequence: " + (summary.peptide.originalSequence || "Not provided"),
      "  Normalized sequence: " + summary.peptide.normalizedSequence,
      "  Peptide length: " + summary.peptide.length,
      "  N-terminal form: " + summary.peptide.nTerminus,
      "  C-terminal form: " + summary.peptide.cTerminus,
      "",
      "Method",
      "  Synthesis scale: " + fixed(summary.synthesis.scaleMmol, 2) + " mmol",
      "  Coupling equivalents: " + fixed(summary.synthesis.couplingEquivalents, 2),
      "  Overage: " + fixed(summary.synthesis.overagePercent, 1) + "%",
      "  Coupling mode: " + summary.synthesis.couplingMode,
      "  Exact double-coupled residues or positions: " + summary.synthesis.doubleCoupling,
      "  Wash settings: " + summary.synthesis.washSettings,
      "  Effective wash count: " + summary.methodEstimates.effectiveWashCount,
      "  DMF attributable to washes: " + (summary.methodEstimates.dmfAttributableToWashesLiters === null ? "Configuration required" : liters(summary.methodEstimates.dmfAttributableToWashesLiters)),
      "  DMF cost attributable to washes: " + (summary.methodEstimates.dmfCostAttributableToWashes === null ? "Configuration required" : money(summary.methodEstimates.dmfCostAttributableToWashes)),
      "  Wash DMF note: wash-attributable DMF is already included in Total DMF amount and Total DMF cost.",
      "",
      "Amino Acids Required",
      formatRequirementLines(summary.aminoAcids.required),
      "",
      "Requester-Supplied Amino Acids",
      formatRequirementLines(summary.aminoAcids.requesterSupplied),
      "",
      "Hematian Lab Amino Acids",
      formatRequirementLines(summary.aminoAcids.hematianLab),
      "",
      "Amino-Acid Mass Totals",
      "  Total amino-acid mass: " + fixed(summary.aminoAcids.totalMassGrams, 3) + " g",
      "  Hematian Lab amino-acid mass: " + fixed(summary.aminoAcids.hematianLabMassGrams, 3) + " g",
      "  Requester-supplied amino-acid mass: " + fixed(summary.aminoAcids.requesterSuppliedMassGrams, 3) + " g",
      "",
      "Reagents",
      "  Total DMF estimate: " + (summary.reagents.totalDmfAmountLiters === null ? "Configuration required" : liters(summary.reagents.totalDmfAmountLiters) + " / " + money(summary.reagents.totalDmfCost)),
      "  DMF breakdown: " + (summary.reagents.totalDmfAmountLiters === null ? "Configuration required" : "coupling " + liters(summary.reagents.dmfCouplingAmountLiters) + "; deprotection " + liters(summary.reagents.dmfDeprotectionAmountLiters) + "; washes " + liters(summary.reagents.dmfWashAmountLiters)),
      "  Pyrrolidine estimate: " + (summary.reagents.pyrrolidineSolutionAmountLiters === null ? "Configuration required" : liters(summary.reagents.pyrrolidineSolutionAmountLiters) + " / " + money(summary.reagents.pyrrolidineSolutionCost)),
      "",
      "Cost",
      "  Hematian Lab amino-acid subtotal: " + money(summary.aminoAcids.hematianLabSubtotal),
      "  Requester-supplied amino-acid charged subtotal: " + money(0),
      "  DMF cost attributable to washes: " + (summary.methodEstimates.dmfCostAttributableToWashes === null ? "Configuration required; included in Total DMF cost when configured" : money(summary.methodEstimates.dmfCostAttributableToWashes) + " (included in Total DMF cost)"),
      "  Configurable method charges: " + money(summary.methodCharges.total),
      "  Preliminary total: " + (summary.estimateIsIncomplete ? "Incomplete preliminary estimate; partial total " : "") + money(summary.preliminaryTotal),
      "",
      "Missing Configuration Warnings",
      summary.reagents.missingConfiguration.length ? "  " + summary.reagents.missingConfiguration.join("\n  ") : "  None",
      "",
      "User Acknowledgments",
      summary.acknowledgments.map(function (ack) {
        return "  " + (ack.confirmed ? "Confirmed: " : "Missing: ") + ack.label;
      }).join("\n"),
      "",
      "Additional Synthesis Comments",
      "  " + summary.requester.additionalSynthesisComments,
      "",
      "Secure submission will be implemented through the planned backend and is not active in this static GitHub Pages version."
    ].join("\n");
  }

  function prepareReview() {
    updateDashboard();
    var state = getCurrentRequestState();
    if (!state.calculationState.isValid) {
      setValidationState(reviewValidation, state.calculationState.messages, "");
      reviewSummary.textContent = "Resolve validation issues before reviewing or exporting this request.";
      reviewSummary.focus();
      return null;
    }

    var summary = buildRequestSummary(state);
    latestRequestSummary = summary;
    setValidationState(reviewValidation, [], "Review summary is ready for export or printing.");
    reviewSummary.textContent = formatReviewSummary(summary);
    return summary;
  }

  function reviewRequest() {
    var summary = prepareReview();
    if (!summary) {
      return;
    }

    reviewSummary.focus();
    reviewSummary.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function downloadText(filename, mimeType, content) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    var summary = prepareReview();
    if (!summary) {
      return;
    }

    downloadText("liberty-blue-request.json", "application/json", JSON.stringify(summary, null, 2));
    setValidationState(reviewValidation, [], "JSON export prepared.");
  }

  function csvCell(value) {
    var text = String(value === undefined || value === null ? "" : value);
    if (/[",\n\r]/.test(text)) {
      return "\"" + text.replace(/"/g, "\"\"") + "\"";
    }
    return text;
  }

  function exportCsv() {
    var summary = prepareReview();
    if (!summary) {
      return;
    }

    var lines = [
      ["Section", "Item", "Code", "Description", "Source", "Count", "Cycles", "mmol", "Grams", "Unit Price", "Estimated Cost"].map(csvCell).join(",")
    ];

    summary.aminoAcids.required.forEach(function (row) {
      lines.push([
        "Amino acid",
        "Requirement",
        row.code,
        row.protectedAminoAcid,
        row.source,
        row.count,
        row.cycles,
        fixed(row.requiredMmol, 3),
        fixed(row.grams, 3),
        fixed(row.unitPrice, 2),
        fixed(row.estimatedCost, 2)
      ].map(csvCell).join(","));
    });

    [
      ["Cost", "Hematian Lab amino-acid subtotal", "", "", "", "", "", "", "", "", fixed(summary.aminoAcids.hematianLabSubtotal, 2)],
      ["Cost", "Requester-supplied charged subtotal", "", "", "", "", "", "", "", "", "0.00"],
      ["Cost", "Total DMF cost", "", summary.reagents.totalDmfAmountLiters === null ? "Configuration required" : liters(summary.reagents.totalDmfAmountLiters), "Hematian Lab", "", "", "", "", "", summary.reagents.totalDmfCost === null ? "Configuration required" : fixed(summary.reagents.totalDmfCost, 2)],
      ["Reagent breakdown", "DMF used for coupling", "", summary.reagents.dmfCouplingAmountLiters === null ? "Configuration required" : liters(summary.reagents.dmfCouplingAmountLiters), "Hematian Lab", "", "", "", "", "", ""],
      ["Reagent breakdown", "DMF used for deprotection", "", summary.reagents.dmfDeprotectionAmountLiters === null ? "Configuration required" : liters(summary.reagents.dmfDeprotectionAmountLiters), "Hematian Lab", "", "", "", "", "", ""],
      ["Reagent breakdown", "DMF used for washes", "", summary.reagents.dmfWashAmountLiters === null ? "Configuration required" : liters(summary.reagents.dmfWashAmountLiters), "Hematian Lab", "", "", "", "", "", ""],
      ["Cost", "Pyrrolidine solution cost", "", summary.reagents.pyrrolidineSolutionAmountLiters === null ? "Configuration required" : liters(summary.reagents.pyrrolidineSolutionAmountLiters), "Hematian Lab", "", "", "", "", "", summary.reagents.pyrrolidineSolutionCost === null ? "Configuration required" : fixed(summary.reagents.pyrrolidineSolutionCost, 2)],
      ["Method-related estimate", "Wash option", "", summary.methodEstimates.washOption, "", "", "", "", "", "", ""],
      ["Method-related estimate", "Effective wash count", "", "", "", summary.methodEstimates.effectiveWashCount, "", "", "", "", ""],
      ["Method-related estimate", "DMF attributable to washes", "", summary.methodEstimates.dmfAttributableToWashesLiters === null ? "Configuration required" : liters(summary.methodEstimates.dmfAttributableToWashesLiters), "Hematian Lab", summary.methodEstimates.effectiveWashCount, "", "", "", "", ""],
      ["Method-related estimate", "DMF cost attributable to washes", "", summary.methodEstimates.dmfAttributableToWashesLiters === null ? "Configuration required" : liters(summary.methodEstimates.dmfAttributableToWashesLiters), "Hematian Lab", summary.methodEstimates.effectiveWashCount, "", "", "", "", summary.methodEstimates.dmfCostAttributableToWashes === null ? "Configuration required" : fixed(summary.methodEstimates.dmfCostAttributableToWashes, 2)],
      ["Method-related estimate", "Wash DMF inclusion note", "", "Included in Total DMF amount and Total DMF cost", "", "", "", "", "", "", ""],
      ["Cost", "Configurable method charges", "", "", "", "", "", "", "", "", fixed(summary.methodCharges.total, 2)],
      ["Cost", "Preliminary total", "", summary.estimateIsIncomplete ? "Incomplete preliminary estimate" : "", "", "", "", "", "", "", fixed(summary.preliminaryTotal, 2)]
    ].forEach(function (line) {
      lines.push(line.map(csvCell).join(","));
    });

    downloadText("liberty-blue-amino-acid-cost-estimate.csv", "text/csv", lines.join("\n"));
    setValidationState(reviewValidation, [], "CSV export prepared.");
  }

  function printRequest() {
    var summary = prepareReview();
    if (!summary) {
      return;
    }

    window.print();
  }

  function bindEvents() {
    document.getElementById("analyzeButton").addEventListener("click", updateDashboard);
    document.getElementById("recalculateButton").addEventListener("click", updateDashboard);
    document.getElementById("panelRecalculateButton").addEventListener("click", updateDashboard);
    document.getElementById("addCustomAaButton").addEventListener("click", addCustomRow);
    document.getElementById("clearPositionsButton").addEventListener("click", clearSelectedPositions);
    document.getElementById("saveDraftButton").addEventListener("click", saveDraft);
    document.getElementById("loadDraftButton").addEventListener("click", function () {
      loadDraft(true);
    });
    document.getElementById("clearFormButton").addEventListener("click", clearForm);
    document.getElementById("reviewButton").addEventListener("click", reviewRequest);
    document.getElementById("panelReviewButton").addEventListener("click", reviewRequest);
    document.getElementById("exportJsonButton").addEventListener("click", exportJson);
    document.getElementById("exportCsvButton").addEventListener("click", exportCsv);
    document.getElementById("printButton").addEventListener("click", printRequest);
    aaTableBody.addEventListener("change", handleTableChange);
    aaTableBody.addEventListener("click", handleTableClick);
    sequencePositionList.addEventListener("change", handlePositionChange);
    methodChargeInputs.forEach(function (input) {
      input.addEventListener("input", updateDashboard);
      input.addEventListener("change", updateDashboard);
    });
    [requesterEmailInput, piEmailInput].forEach(function (input) {
      if (input) {
        input.addEventListener("input", validateRequesterInformation);
        input.addEventListener("change", validateRequesterInformation);
      }
    });
    acknowledgmentInputs.forEach(function (input) {
      input.addEventListener("change", validateRequesterInformation);
    });

    [
      sequenceInput,
      scaleInput,
      equivalentsInput,
      overagePercentInput,
      couplingModeInput,
      washOptionInput,
      customWashCountInput
    ].forEach(function (field) {
      field.addEventListener("input", updateDashboard);
      field.addEventListener("change", updateDashboard);
    });
  }

  window.LibertyBlueSequence = {
    normalizeSequence: normalizeSequence,
    detectTerminalGroups: detectTerminalGroups,
    validateSequence: validateSequence,
    countAminoAcids: countAminoAcids,
    mapSequencePositions: mapSequencePositions,
    calculateAminoAcidPercentages: calculateAminoAcidPercentages,
    analyzeSequence: analyzeSequence
  };

  window.LibertyBlueRequirements = {
    getSettings: getSettings,
    buildRequirements: buildRequirements,
    theoreticalRequirement: theoreticalRequirement,
    reagentConfig: reagentConfig,
    getConfiguredReagentConfig: getConfiguredReagentConfig,
    calculateReagentCycles: calculateReagentCycles,
    calculateReagentEstimate: calculateReagentEstimate,
    getMethodCharges: getMethodCharges,
    getCurrentRequestState: getCurrentRequestState,
    buildRequestSummary: buildRequestSummary
  };

  window.LibertyBlueState = {
    getLatestAnalysis: function () {
      return latestAnalysis;
    },
    getLatestRequirements: function () {
      return latestRequirements;
    },
    getLatestReagentEstimate: function () {
      return latestReagentEstimate;
    },
    getLatestTotals: function () {
      return latestTotals;
    },
    getLatestRequestSummary: function () {
      return latestRequestSummary;
    }
  };

  loadReagentConfig();
  loadDraft();
  bindEvents();
  updateDashboard();
})();
