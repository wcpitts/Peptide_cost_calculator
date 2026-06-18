(function () {
  "use strict";

  /*
   * Molecular weights are average formula weights in g/mol for the exact
   * protected Fmoc derivatives listed in buildingBlock.
   *
   * pricePerGram values are demonstration placeholders only and are not
   * official Hematian Lab prices.
   */
  window.AMINO_ACIDS = [
    {
      code: "A",
      name: "Alanine",
      buildingBlock: "Fmoc-Ala-OH",
      molecularFormula: "C18H17NO4",
      molecularWeight: 311.34,
      residueMass: 71.08,
      pricePerGram: 8.75,
      stockGrams: 12.5
    },
    {
      code: "R",
      name: "Arginine",
      buildingBlock: "Fmoc-Arg(Pbf)-OH",
      molecularFormula: "C34H40N4O7S",
      molecularWeight: 648.78,
      residueMass: 156.19,
      pricePerGram: 38.5,
      stockGrams: 3.1
    },
    {
      code: "N",
      name: "Asparagine",
      buildingBlock: "Fmoc-Asn(Trt)-OH",
      molecularFormula: "C38H32N2O5",
      molecularWeight: 596.68,
      residueMass: 114.1,
      pricePerGram: 15.8,
      stockGrams: 7.4
    },
    {
      code: "D",
      name: "Aspartic acid",
      buildingBlock: "Fmoc-Asp(OtBu)-OH",
      molecularFormula: "C23H25NO6",
      molecularWeight: 411.45,
      residueMass: 115.09,
      pricePerGram: 14.6,
      stockGrams: 8.8
    },
    {
      code: "C",
      name: "Cysteine",
      buildingBlock: "Fmoc-Cys(Trt)-OH",
      molecularFormula: "C37H31NO4S",
      molecularWeight: 585.72,
      residueMass: 103.14,
      pricePerGram: 28.4,
      stockGrams: 4.2
    },
    {
      code: "Q",
      name: "Glutamine",
      buildingBlock: "Fmoc-Gln(Trt)-OH",
      molecularFormula: "C39H34N2O5",
      molecularWeight: 610.71,
      residueMass: 128.13,
      pricePerGram: 16.4,
      stockGrams: 6.5
    },
    {
      code: "E",
      name: "Glutamic acid",
      buildingBlock: "Fmoc-Glu(OtBu)-OH",
      molecularFormula: "C24H27NO6",
      molecularWeight: 425.48,
      residueMass: 129.12,
      pricePerGram: 13.9,
      stockGrams: 9.4
    },
    {
      code: "G",
      name: "Glycine",
      buildingBlock: "Fmoc-Gly-OH",
      molecularFormula: "C17H15NO4",
      molecularWeight: 297.31,
      residueMass: 57.05,
      pricePerGram: 7.2,
      stockGrams: 15
    },
    {
      code: "H",
      name: "Histidine",
      buildingBlock: "Fmoc-His(Trt)-OH",
      molecularFormula: "C40H33N3O4",
      molecularWeight: 619.72,
      residueMass: 137.14,
      pricePerGram: 34.8,
      stockGrams: 3.6
    },
    {
      code: "I",
      name: "Isoleucine",
      buildingBlock: "Fmoc-Ile-OH",
      molecularFormula: "C21H23NO4",
      molecularWeight: 353.42,
      residueMass: 113.16,
      pricePerGram: 15.4,
      stockGrams: 6.8
    },
    {
      code: "L",
      name: "Leucine",
      buildingBlock: "Fmoc-Leu-OH",
      molecularFormula: "C21H23NO4",
      molecularWeight: 353.42,
      residueMass: 113.16,
      pricePerGram: 14.9,
      stockGrams: 8
    },
    {
      code: "K",
      name: "Lysine",
      buildingBlock: "Fmoc-Lys(Boc)-OH",
      molecularFormula: "C26H32N2O6",
      molecularWeight: 468.55,
      residueMass: 128.17,
      pricePerGram: 18.8,
      stockGrams: 5.3
    },
    {
      code: "M",
      name: "Methionine",
      buildingBlock: "Fmoc-Met-OH",
      molecularFormula: "C20H21NO4S",
      molecularWeight: 371.45,
      residueMass: 131.2,
      pricePerGram: 19.1,
      stockGrams: 5.7
    },
    {
      code: "F",
      name: "Phenylalanine",
      buildingBlock: "Fmoc-Phe-OH",
      molecularFormula: "C24H21NO4",
      molecularWeight: 387.44,
      residueMass: 147.18,
      pricePerGram: 16.2,
      stockGrams: 6.1
    },
    {
      code: "P",
      name: "Proline",
      buildingBlock: "Fmoc-Pro-OH",
      molecularFormula: "C20H19NO4",
      molecularWeight: 337.37,
      residueMass: 97.12,
      pricePerGram: 12.5,
      stockGrams: 10.6
    },
    {
      code: "S",
      name: "Serine",
      buildingBlock: "Fmoc-Ser(tBu)-OH",
      molecularFormula: "C22H25NO5",
      molecularWeight: 383.44,
      residueMass: 87.08,
      pricePerGram: 12.8,
      stockGrams: 9
    },
    {
      code: "T",
      name: "Threonine",
      buildingBlock: "Fmoc-Thr(tBu)-OH",
      molecularFormula: "C23H27NO5",
      molecularWeight: 397.47,
      residueMass: 101.11,
      pricePerGram: 13.7,
      stockGrams: 8.5
    },
    {
      code: "W",
      name: "Tryptophan",
      buildingBlock: "Fmoc-Trp(Boc)-OH",
      molecularFormula: "C31H30N2O6",
      molecularWeight: 526.59,
      residueMass: 186.21,
      pricePerGram: 45,
      stockGrams: 2.4
    },
    {
      code: "Y",
      name: "Tyrosine",
      buildingBlock: "Fmoc-Tyr(tBu)-OH",
      molecularFormula: "C28H29NO5",
      molecularWeight: 459.54,
      residueMass: 163.18,
      pricePerGram: 22.6,
      stockGrams: 4.9
    },
    {
      code: "V",
      name: "Valine",
      buildingBlock: "Fmoc-Val-OH",
      molecularFormula: "C20H21NO4",
      molecularWeight: 339.39,
      residueMass: 99.13,
      pricePerGram: 13.2,
      stockGrams: 9.8
    }
  ];
})();
