1. User Model
Pre-save Hook

Purpose:
Automatically hash the password before saving a new user or when the password changes.

Trigger:

Before save

Actions:

Hash password using bcrypt.
Normalize email to lowercase.
Instance Method
comparePassword(candidatePassword)

Purpose:
Compare the entered password with the stored hashed password during login.

Static Method
findByEmail(email)

Purpose:
Retrieve a user by email for authentication.

2. Company Model
Pre-save Hook

Purpose:
Automatically generate:

companyCode

Example:

CMP-0001
3. Customer Model
Pre-save Hook

Generate

customerCode

CUS-0001
4. Driver Model
Pre-save Hook

Generate

employeeId

DRV-0001

No other hooks are required at the model level.

Business operations such as assigning jobs or changing availability should be handled in the service layer, not inside model hooks.

5. Vehicle Model
Pre-save Hook

Generate

vehicleCode

VEH-0001
6. Service Model
Pre-save Hook

Generate

serviceCode

SER-0001
7. Job Model
Pre-save Hook

Generate

jobNumber

JOB-YYYYMMDD-00001

Automatically initialize:

status = PENDING

if no status is provided.

Important: Do not calculate the fare in a Mongoose hook. The fare depends on dynamic external inputs (distance, fuel price, weather, rush hour) and belongs in the service layer, where it can be tested and maintained independently.

8. Vehicle Location Model

No hooks.

Reason:
This collection will receive frequent GPS updates, and hooks would introduce unnecessary overhead.

9. Rating Model
Post-save Hook

After a new rating is saved:

Recalculate the driver's average rating.
Update the driver's total number of ratings.
10. Notification Model

No hooks.

Notifications should be created by the business logic (services) when events occur, not automatically by the model.

11. Document Model

No hooks.

Document expiry checks should be performed by scheduled background jobs (cron jobs) rather than model middleware.

Hook Summary Table
Model	Hook	Purpose
User	Pre-save	Hash password, normalize email
User	Instance Method	Compare password
User	Static Method	Find user by email
Company	Pre-save	Generate companyCode
Customer	Pre-save	Generate customerCode
Driver	Pre-save	Generate employeeId
Vehicle	Pre-save	Generate vehicleCode
Service	Pre-save	Generate serviceCode
Job	Pre-save	Generate jobNumber, initialize status
Rating	Post-save	Update driver's average rating
VehicleLocation	None	High-frequency writes
Notification	None	Managed by service layer
Document	None	Expiry handled by scheduled jobs

