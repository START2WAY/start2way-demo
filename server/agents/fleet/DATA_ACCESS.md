# DATA ACCESS

L'agent peut demander uniquement les données nécessaires telles que :

Vehicle:
- plate_number
- brand
- model
- vehicle_type
- vin
- first_registration_date
- initial_company_odometer
- last_known_km
- status

Technical inspection:
- technical_inspection_date
- technical_inspection_expiry_date

Insurance:
- insurance_start_date
- insurance_expiry_date

Lease:
- is_leased
- lease_start_date
- lease_end_date
- lessor_name
- lease_contract_reference

Maintenance:
- last_service_date
- last_service_odometer
- next_service_date
- next_service_odometer

Maintenance events:
- type
- date
- odometer
- description
- provider
- next_due_date
- next_due_odometer

Document metadata:
- document_type
- issue_date
- expiry_date
- verification_status

Règles strictes :
- Pas d'accès SQL direct (le LLM ne reçoit jamais de base SQLite, ni de requêtes SQL libres).
- Accès aux données de la flotte autorisé UNIQUEMENT via les outils backend pré-définis.
- Vérification automatique par le backend de la Company (pas d'accès cross-company possible).
