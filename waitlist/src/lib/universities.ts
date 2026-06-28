export interface UniversityPreset {
  name: string;
  flag: string;
  country: string;
}

export const UNIVERSITY_PRESETS: UniversityPreset[] = [
  // United States
  { name: "Harvard University", flag: "🇺🇸", country: "United States" },
  { name: "Yale University", flag: "🇺🇸", country: "United States" },
  { name: "Stanford University", flag: "🇺🇸", country: "United States" },
  { name: "Massachusetts Institute of Technology (MIT)", flag: "🇺🇸", country: "United States" },
  { name: "University of California, Berkeley (UC Berkeley)", flag: "🇺🇸", country: "United States" },
  { name: "University of California, Los Angeles (UCLA)", flag: "🇺🇸", country: "United States" },
  { name: "Columbia University", flag: "🇺🇸", country: "United States" },
  { name: "New York University (NYU)", flag: "🇺🇸", country: "United States" },
  { name: "Boston University (BU)", flag: "🇺🇸", country: "United States" },
  { name: "University of Southern California (USC)", flag: "🇺🇸", country: "United States" },
  { name: "Cornell University", flag: "🇺🇸", country: "United States" },
  { name: "Princeton University", flag: "🇺🇸", country: "United States" },
  { name: "University of Chicago", flag: "🇺🇸", country: "United States" },
  { name: "Northwestern University", flag: "🇺🇸", country: "United States" },
  { name: "University of Michigan", flag: "🇺🇸", country: "United States" },
  { name: "University of Pennsylvania (UPenn)", flag: "🇺🇸", country: "United States" },

  // United Kingdom
  { name: "University of Oxford", flag: "🇬🇧", country: "United Kingdom" },
  { name: "University of Cambridge", flag: "🇬🇧", country: "United Kingdom" },
  { name: "London School of Economics (LSE)", flag: "🇬🇧", country: "United Kingdom" },
  { name: "University College London (UCL)", flag: "🇬🇧", country: "United Kingdom" },
  { name: "Imperial College London", flag: "🇬🇧", country: "United Kingdom" },
  { name: "King's College London (KCL)", flag: "🇬🇧", country: "United Kingdom" },
  { name: "University of Edinburgh", flag: "🇬🇧", country: "United Kingdom" },
  { name: "University of Manchester", flag: "🇬🇧", country: "United Kingdom" },
  { name: "University of Warwick", flag: "🇬🇧", country: "United Kingdom" },

  // Europe
  { name: "LMU Munich (Ludwig-Maximilians-Universität)", flag: "🇩🇪", country: "Germany" },
  { name: "Technical University of Munich (TUM)", flag: "🇩🇪", country: "Germany" },
  { name: "Heidelberg University", flag: "🇩🇪", country: "Germany" },
  { name: "ETH Zurich", flag: "🇨🇭", country: "Switzerland" },
  { name: "EPFL (Ecole Polytechnique Fédérale de Lausanne)", flag: "🇨🇭", country: "Switzerland" },
  { name: "HEC Paris", flag: "🇫🇷", country: "France" },
  { name: "ESCP Business School", flag: "🇫🇷", country: "France" },
  { name: "Sorbonne University", flag: "🇫🇷", country: "France" },
  { name: "Sciences Po", flag: "🇫🇷", country: "France" },
  { name: "Bocconi University", flag: "🇮🇹", country: "Italy" },
  { name: "Erasmus University Rotterdam", flag: "🇳🇱", country: "Netherlands" },
  { name: "University of Amsterdam", flag: "🇳🇱", country: "Netherlands" },
  { name: "Copenhagen Business School (CBS)", flag: "🇩🇰", country: "Denmark" },
  { name: "Stockholm School of Economics", flag: "🇸🇪", country: "Sweden" },

  // Singapore & Asia
  { name: "National University of Singapore (NUS)", flag: "🇸🇬", country: "Singapore" },
  { name: "Nanyang Technological University (NTU)", flag: "🇸🇬", country: "Singapore" },
  { name: "Singapore Management University (SMU)", flag: "🇸🇬", country: "Singapore" },
  { name: "University of Hong Kong (HKU)", flag: "🇭🇰", country: "Hong Kong" },
  { name: "Hong Kong University of Science and Technology (HKUST)", flag: "🇭🇰", country: "Hong Kong" },
  { name: "Chinese University of Hong Kong (CUHK)", flag: "🇭🇰", country: "Hong Kong" },
  { name: "Tsinghua University", flag: "🇨🇳", country: "China" },
  { name: "Peking University", flag: "🇨🇳", country: "China" },
  { name: "University of Tokyo", flag: "🇯🇵", country: "Japan" },
  { name: "Kyoto University", flag: "🇯🇵", country: "Japan" },
  { name: "Waseda University", flag: "🇯🇵", country: "Japan" },
  { name: "Keio University", flag: "🇯🇵", country: "Japan" },
  { name: "Seoul National University (SNU)", flag: "🇰🇷", country: "South Korea" },
  { name: "KAIST", flag: "🇰🇷", country: "South Korea" },
  { name: "Yonsei University", flag: "🇰🇷", country: "South Korea" },
  { name: "Korea University", flag: "🇰🇷", country: "South Korea" },

  // Thailand
  { name: "Chulalongkorn University", flag: "🇹🇭", country: "Thailand" },
  { name: "Thammasat University", flag: "🇹🇭", country: "Thailand" },
  { name: "Mahidol University", flag: "🇹🇭", country: "Thailand" },
  { name: "Kasetsart University", flag: "🇹🇭", country: "Thailand" },

  // Australia & New Zealand
  { name: "University of Sydney", flag: "🇦🇺", country: "Australia" },
  { name: "University of Melbourne", flag: "🇦🇺", country: "Australia" },
  { name: "University of New South Wales (UNSW)", flag: "🇦🇺", country: "Australia" },
  { name: "University of Queensland (UQ)", flag: "🇦🇺", country: "Australia" },
  { name: "Australian National University (ANU)", flag: "🇦🇺", country: "Australia" },
  { name: "Monash University", flag: "🇦🇺", country: "Australia" },
  { name: "University of Auckland", flag: "🇳🇿", country: "New Zealand" },

  // Canada
  { name: "University of Toronto", flag: "🇨🇦", country: "Canada" },
  { name: "McGill University", flag: "🇨🇦", country: "Canada" },
  { name: "University of British Columbia (UBC)", flag: "🇨🇦", country: "Canada" },
  { name: "University of Waterloo", flag: "🇨🇦", country: "Canada" }
].sort((a, b) => a.name.localeCompare(b.name));
