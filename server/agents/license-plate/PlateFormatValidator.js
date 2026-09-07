
class PlateFormatValidator {
    static validate(country, rawPlate) {
        if (!country || !rawPlate) return { normalized: rawPlate, format_type: 'UNKNOWN_FORMAT', match: false, source_status: 'UNVERIFIED', format_id: null };
        
        let normalized = rawPlate.toUpperCase().replace(/\s+|-/g, '');
        let bestMatch = { normalized: rawPlate, format_type: 'UNKNOWN_FORMAT', match: false, source_status: 'UNVERIFIED', format_id: null };
        
        // Aliases
        if (country === 'UK') country = 'GB';

        const formats = this.getFormats();
        if (!formats[country]) return bestMatch;
        
        for (const fmt of formats[country]) {
            const regex = new RegExp(fmt.regex);
            if (regex.test(normalized)) {
                let normOutput = normalized;
                if (fmt.normalize !== 'RAW') {
                    // Apply basic normalization logic for verified formats
                    if (country === 'FR' && fmt.id === 'FR_SIV') normOutput = normalized.replace(/^([A-Z]{2})([0-9]{3})([A-Z]{2})$/, '$1-$2-$3');
                    if (country === 'DE') normOutput = normalized.replace(/^([A-Z]{1,3})([A-Z]{1,2})([0-9]{1,4})$/, '$1-$2 $3');
                    if (country === 'BE') normOutput = normalized.replace(/^([1-9])([A-Z]{3})([0-9]{3})$/, '$1-$2-$3');
                    if (country === 'ES') normOutput = normalized.replace(/^([0-9]{4})([A-Z]{3})$/, '$1 $2');
                    if (country === 'IT') normOutput = normalized.replace(/^([A-Z]{2})([0-9]{3})([A-Z]{2})$/, '$1 $2$3');
                    if (country === 'PT') normOutput = normalized.replace(/^([A-Z0-9]{2})([A-Z0-9]{2})([A-Z0-9]{2})$/, '$1-$2-$3');
                    if (country === 'LU' || country === 'CH') normOutput = normalized.replace(/^([A-Z]{2})([0-9]+)$/, '$1 $2');
                    if (country === 'GB') normOutput = normalized.replace(/^([A-Z]{2}[0-9]{2})([A-Z]{3})$/, '$1 $2');
                }
                
                return {
                    normalized: normOutput,
                    format_type: fmt.type,
                    match: true,
                    status: fmt.source_status === 'VERIFIED' ? 'FORMAT_RECOGNIZED' : 'FORMAT_POSSIBLE',
                    user_confirmation_required: fmt.source_status !== 'VERIFIED',
                    source_status: fmt.source_status,
                    format_id: fmt.id
                };
            }
        }
        
        return bestMatch;
    }

    static getFormats() {
    return {
          "AT": [
                {
                      "id": "AT_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{1,2}[0-9]{1,5}[A-Z]{1,3}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "Bundesministerium für Klimaschutz, Umwelt, Energie, Mobilität, Innovation und Technologie (BMK)",
                      "source_status": "UNVERIFIED",
                      "source_url": "NONE",
                      "source_title": "NONE",
                      "source_type": "NONE",
                      "last_verified": "2026-09-05"
                }
          ],
          "BE": [
                {
                      "id": "BE_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[1-9][A-Z]{3}[0-9]{3}$",
                      "normalize": "1-ABC-123",
                      "status": "VERIFIED",
                      "source": "Direction pour l'Immatriculation des Véhicules (DIV)",
                      "source_status": "PARTIAL",
                      "source_url": "https://mobilit.belgium.be/fr/route/immatriculer-et-radier",
                      "source_title": "SPF Mobilité",
                      "source_type": "TRANSPORT MINISTRY",
                      "last_verified": "2026-09-05"
                }
          ],
          "BG": [
                {
                      "id": "BG_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{1,2}[0-9]{4}[A-Z]{2}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "Ministry of Interior (MVR)",
                      "source_status": "UNVERIFIED",
                      "source_url": "NONE",
                      "source_title": "NONE",
                      "source_type": "NONE",
                      "last_verified": "2026-09-05"
                }
          ],
          "HR": [
                {
                      "id": "HR_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{2}[0-9]{3,4}[A-Z]{1,2}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "Ministry of Interior (MUP)",
                      "source_status": "PARTIAL",
                      "source_url": "https://mup.gov.hr/registracija-vozila/329",
                      "source_title": "MUP - Registracija vozila",
                      "source_type": "NATIONAL GOVERNMENT",
                      "last_verified": "2026-09-05"
                }
          ],
          "CY": [
                {
                      "id": "CY_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{3}[0-9]{3}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "Department of Road Transport (TOM)",
                      "source_status": "UNVERIFIED",
                      "source_url": "NONE",
                      "source_title": "NONE",
                      "source_type": "NONE",
                      "last_verified": "2026-09-05"
                }
          ],
          "CZ": [
                {
                      "id": "CZ_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[0-9][A-Z][0-9A-Z][0-9]{4}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "Ministry of Transport (MDCR)",
                      "source_status": "PARTIAL",
                      "source_url": "https://www.mdcr.cz/Zivotni-situace/Registr-vozidel",
                      "source_title": "MDCR - Registr vozidel",
                      "source_type": "NATIONAL GOVERNMENT",
                      "last_verified": "2026-09-05"
                }
          ],
          "DK": [
                {
                      "id": "DK_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{2}[0-9]{5}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "Danish Motor Register (DMR)",
                      "source_status": "UNVERIFIED",
                      "source_url": "NONE",
                      "source_title": "NONE",
                      "source_type": "NONE",
                      "last_verified": "2026-09-05"
                }
          ],
          "EE": [
                {
                      "id": "EE_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[0-9]{3}[A-Z]{3}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "Transport Administration (Transpordiamet)",
                      "source_status": "UNVERIFIED",
                      "source_url": "https://transpordiamet.ee/soidukite-registreerimine",
                      "source_title": "Transpordiamet",
                      "source_type": "NATIONAL GOVERNMENT",
                      "last_verified": "2026-09-05"
                }
          ],
          "FI": [
                {
                      "id": "FI_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{2,3}[0-9]{1,3}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "Finnish Transport and Communications Agency (Traficom)",
                      "source_status": "UNVERIFIED",
                      "source_url": "NONE",
                      "source_title": "NONE",
                      "source_type": "NONE",
                      "last_verified": "2026-09-05"
                }
          ],
          "FR": [
                {
                      "id": "FR_SIV",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{2}[0-9]{3}[A-Z]{2}$",
                      "normalize": "AB-123-CD",
                      "status": "VERIFIED",
                      "source": "Ministère de l'Intérieur",
                      "source_status": "VERIFIED",
                      "source_url": "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000020237165",
                      "source_title": "Arrêté du 9 février 2009",
                      "source_type": "LAW",
                      "last_verified": "2026-09-05"
                },
                {
                      "id": "FR_FNI",
                      "type": "LEGACY_VALID_FORMAT",
                      "regex": "^[0-9]{1,4}[A-Z]{2,3}[0-9]{2,3}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "Ministère de l'Intérieur",
                      "source_status": "UNVERIFIED",
                      "source_url": "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000020237165",
                      "source_title": "Arrêté du 9 février 2009",
                      "source_type": "LAW",
                      "last_verified": "2026-09-05"
                }
          ],
          "DE": [
                {
                      "id": "DE_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{1,3}[A-Z]{1,2}[0-9]{1,4}$",
                      "normalize": "M-AB 1234",
                      "status": "VERIFIED",
                      "source": "Fahrzeug-Zulassungsverordnung (FZV)",
                      "source_status": "VERIFIED",
                      "source_url": "https://www.gesetze-im-internet.de/fzv_2023/__10.html",
                      "source_title": "Fahrzeug-Zulassungsverordnung (FZV) § 10",
                      "source_type": "LAW",
                      "last_verified": "2026-09-05"
                }
          ],
          "GR": [
                {
                      "id": "GR_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{3}[0-9]{4}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "Ministry of Infrastructure and Transport",
                      "source_status": "UNVERIFIED",
                      "source_url": "NONE",
                      "source_title": "NONE",
                      "source_type": "NONE",
                      "last_verified": "2026-09-05"
                }
          ],
          "HU": [
                {
                      "id": "HU_CURRENT_2022",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{4}[0-9]{3}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "Ministry of Interior",
                      "source_status": "UNVERIFIED",
                      "source_url": "NONE",
                      "source_title": "NONE",
                      "source_type": "NONE",
                      "last_verified": "2026-09-05"
                },
                {
                      "id": "HU_LEGACY",
                      "type": "LEGACY_VALID_FORMAT",
                      "regex": "^[A-Z]{3}[0-9]{3}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "Ministry of Interior",
                      "source_status": "UNVERIFIED",
                      "source_url": "NONE",
                      "source_title": "NONE",
                      "source_type": "NONE",
                      "last_verified": "2026-09-05"
                }
          ],
          "IE": [
                {
                      "id": "IE_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[0-9]{2,3}[A-Z]{1,2}[0-9]{1,6}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "Revenue Commissioners",
                      "source_status": "VERIFIED",
                      "source_url": "https://www.revenue.ie/en/importing-vehicles-duty-free-allowances/guide-to-vrt/vehicle-registration-tax/vehicle-registration-plates.aspx",
                      "source_title": "Revenue - Vehicle Registration Plates",
                      "source_type": "NATIONAL GOVERNMENT",
                      "last_verified": "2026-09-05"
                }
          ],
          "IT": [
                {
                      "id": "IT_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{2}[0-9]{3}[A-Z]{2}$",
                      "normalize": "AB 123CD",
                      "status": "VERIFIED",
                      "source": "Ministero delle Infrastrutture e dei Trasporti",
                      "source_status": "UNVERIFIED",
                      "source_url": "NONE",
                      "source_title": "NONE",
                      "source_type": "NONE",
                      "last_verified": "2026-09-05"
                }
          ],
          "LV": [
                {
                      "id": "LV_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{2}[0-9]{1,4}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "Road Traffic Safety Directorate (CSDD)",
                      "source_status": "UNVERIFIED",
                      "source_url": "https://www.csdd.lv/en/transportlidzeklu-numura-zimes/vispariga-informacija",
                      "source_title": "CSDD",
                      "source_type": "REGISTRATION AUTHORITY",
                      "last_verified": "2026-09-05"
                }
          ],
          "LT": [
                {
                      "id": "LT_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{3}[0-9]{3}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "State Enterprise Regitra",
                      "source_status": "UNVERIFIED",
                      "source_url": "https://www.regitra.lt/en/services/number-plates",
                      "source_title": "Regitra",
                      "source_type": "REGISTRATION AUTHORITY",
                      "last_verified": "2026-09-05"
                }
          ],
          "LU": [
                {
                      "id": "LU_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{2}[0-9]{4}$",
                      "normalize": "AB 1234",
                      "status": "VERIFIED",
                      "source": "Société Nationale de Circulation Automobile (SNCA)",
                      "source_status": "UNVERIFIED",
                      "source_url": "NONE",
                      "source_title": "NONE",
                      "source_type": "NONE",
                      "last_verified": "2026-09-05"
                }
          ],
          "MT": [
                {
                      "id": "MT_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{3}[0-9]{3}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "Transport Malta",
                      "source_status": "UNVERIFIED",
                      "source_url": "NONE",
                      "source_title": "NONE",
                      "source_type": "NONE",
                      "last_verified": "2026-09-05"
                }
          ],
          "NL": [
                {
                      "id": "NL_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z0-9]{6}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "RDW (Rijksdienst voor het Wegverkeer)",
                      "source_status": "UNVERIFIED",
                      "source_url": "NONE",
                      "source_title": "NONE",
                      "source_type": "NONE",
                      "last_verified": "2026-09-05"
                }
          ],
          "PL": [
                {
                      "id": "PL_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{2,3}[0-9A-Z]{4,5}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "Ministry of Infrastructure",
                      "source_status": "PARTIAL",
                      "source_url": "https://www.gov.pl/web/infrastruktura/rejestracja-pojazdow",
                      "source_title": "Gov.pl - Rejestracja",
                      "source_type": "NATIONAL GOVERNMENT",
                      "last_verified": "2026-09-05"
                }
          ],
          "PT": [
                {
                      "id": "PT_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z0-9]{2}[A-Z0-9]{2}[A-Z0-9]{2}$",
                      "normalize": "AB-12-CD",
                      "status": "VERIFIED",
                      "source": "Instituto da Mobilidade e dos Transportes (IMT)",
                      "source_status": "PARTIAL",
                      "source_url": "https://www.imt-ip.pt/sites/IMTT/Portugues/Veiculos/Matriculas/Paginas/Matriculas.aspx",
                      "source_title": "IMT - Matriculas",
                      "source_type": "TRANSPORT MINISTRY",
                      "last_verified": "2026-09-05"
                }
          ],
          "RO": [
                {
                      "id": "RO_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{1,2}[0-9]{2,3}[A-Z]{3}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "DRPCIV",
                      "source_status": "UNVERIFIED",
                      "source_url": "NONE",
                      "source_title": "NONE",
                      "source_type": "NONE",
                      "last_verified": "2026-09-05"
                }
          ],
          "SK": [
                {
                      "id": "SK_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{2}[0-9]{3}[A-Z]{2}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "Ministry of Interior",
                      "source_status": "UNVERIFIED",
                      "source_url": "https://www.minv.sk/?tabulky-s-evidencnym-cislom",
                      "source_title": "MINV",
                      "source_type": "NATIONAL GOVERNMENT",
                      "last_verified": "2026-09-05"
                }
          ],
          "SI": [
                {
                      "id": "SI_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{2}[0-9A-Z]{3,6}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "Ministry of Infrastructure",
                      "source_status": "UNVERIFIED",
                      "source_url": "NONE",
                      "source_title": "NONE",
                      "source_type": "NONE",
                      "last_verified": "2026-09-05"
                }
          ],
          "ES": [
                {
                      "id": "ES_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[0-9]{4}[A-Z]{3}$",
                      "normalize": "1234 ABC",
                      "status": "VERIFIED",
                      "source": "Dirección General de Tráfico (DGT)",
                      "source_status": "UNVERIFIED",
                      "source_url": "https://www.dgt.es/nuestros-servicios/tu-vehiculo/tus-placas-de-matricula",
                      "source_title": "DGT",
                      "source_type": "REGISTRATION AUTHORITY",
                      "last_verified": "2026-09-05"
                }
          ],
          "SE": [
                {
                      "id": "SE_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{3}[0-9]{2}[0-9A-Z]$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "Swedish Transport Agency (Transportstyrelsen)",
                      "source_status": "UNVERIFIED",
                      "source_url": "https://www.transportstyrelsen.se/sv/vagtrafik/Fordon/Registreringsskyltar/",
                      "source_title": "Transportstyrelsen",
                      "source_type": "REGISTRATION AUTHORITY",
                      "last_verified": "2026-09-05"
                }
          ],
          "NO": [
                {
                      "id": "NO_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{2}[0-9]{5}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "Norwegian Public Roads Administration (Statens vegvesen)",
                      "source_status": "UNVERIFIED",
                      "source_url": "NONE",
                      "source_title": "NONE",
                      "source_type": "NONE",
                      "last_verified": "2026-09-05"
                }
          ],
          "IS": [
                {
                      "id": "IS_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{2}[0-9A-Z][0-9]{2}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "Icelandic Transport Authority (Samgöngustofa)",
                      "source_status": "PARTIAL",
                      "source_url": "https://www.samgongustofa.is/umferd/okutaeki/skraning-og-merkjar/skraningarmerki/",
                      "source_title": "Samgöngustofa - Skráningarmerki",
                      "source_type": "TRANSPORT MINISTRY",
                      "last_verified": "2026-09-05"
                }
          ],
          "LI": [
                {
                      "id": "LI_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^FL[0-9]{1,5}$",
                      "normalize": "RAW",
                      "status": "VERIFIED",
                      "source": "Motorfahrzeugkontrolle (MFK)",
                      "source_status": "UNVERIFIED",
                      "source_url": "NONE",
                      "source_title": "NONE",
                      "source_type": "NONE",
                      "last_verified": "2026-09-05"
                }
          ],
          "CH": [
                {
                      "id": "CH_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{2}[0-9]{1,6}$",
                      "normalize": "AB 1234",
                      "status": "VERIFIED",
                      "source": "Association des services des automobiles (ASA)",
                      "source_status": "PARTIAL",
                      "source_url": "https://asa.ch/fr/services-des-automobiles/plaques-dimmatriculation/",
                      "source_title": "ASA - Plaques",
                      "source_type": "REGISTRATION AUTHORITY",
                      "last_verified": "2026-09-05"
                }
          ],
          "GB": [
                {
                      "id": "GB_CURRENT",
                      "type": "CURRENT_FORMAT",
                      "regex": "^[A-Z]{2}[0-9]{2}[A-Z]{3}$",
                      "normalize": "AB12 CDE",
                      "status": "VERIFIED",
                      "source": "Driver and Vehicle Licensing Agency (DVLA)",
                      "source_status": "VERIFIED",
                      "source_url": "https://www.gov.uk/displaying-number-plates",
                      "source_title": "GOV.UK - Displaying number plates",
                      "source_type": "REGISTRATION AUTHORITY",
                      "last_verified": "2026-09-05"
                }
          ]
    };
  }
}
module.exports = PlateFormatValidator;
