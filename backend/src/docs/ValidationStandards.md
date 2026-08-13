User Model
| Field     | Validation                                            | Reason                                             |
| --------- | ----------------------------------------------------- | -------------------------------------------------- |
| email     | required, trim, lowercase, unique, valid email format | Prevent duplicate accounts and ensure consistency. |
| phone     | required, trim, unique, UAE phone format              | Used for contact and authentication.               |
| password  | required, minimum 8 chars, maximum 128 chars, hashed  | Security.                                          |
| role      | required, enum                                        | Restrict to Owner, Driver, Customer.               |
| isActive  | default true                                          | Soft activation/deactivation.                      |
| isDeleted | default false                                         | Preserve historical records.                       |


Company Model
| Field              | Validation                     |
| ------------------ | ------------------------------ |
| companyName        | required, trim, min 3, max 100 |
| companyCode        | unique, auto-generated         |
| email              | unique, lowercase              |
| phone              | unique                         |
| logo               | optional URL                   |
| address            | required                       |
| city               | required                       |
| country            | required                       |
| tradeLicenseNumber | unique                         |
| tradeLicenseExpiry | required                       |
| serviceAreas       | minimum 1 area                 |
| ownerId            | required ObjectId              |


Customer Model
| Field           | Validation          |
| --------------- | ------------------- |
| customerCode    | auto-generated      |
| fullName        | required            |
| nationalId      | unique              |
| phone           | unique              |
| email           | optional, lowercase |
| profileImage    | optional            |
| currentLocation | GeoJSON Point       |
| averageRating   | default 5           |
| totalJobs       | default 0           |


Driver Model

| Field                | Validation     |
| -------------------- | -------------- |
| employeeId           | auto-generated |
| fullName             | required       |
| nationalId           | unique         |
| phone                | unique         |
| email                | optional       |
| drivingLicenseNumber | unique         |
| drivingLicenseExpiry | required       |
| emiratesId           | unique         |
| emiratesIdExpiry     | required       |
| profileImage         | optional       |
| rating               | default 5      |
| totalTrips           | default 0      |
| status               | enum           |
| companyId            | required       |


Vehicle Model

| Field                 | Validation        |
| --------------------- | ----------------- |
| vehicleCode           | auto-generated    |
| plateNumber           | unique            |
| chassisNumber         | unique            |
| registrationNumber    | unique            |
| insurancePolicyNumber | unique            |
| insuranceExpiry       | required          |
| registrationExpiry    | required          |
| vehicleType           | enum              |
| recoveryType          | enum              |
| currentStatus         | enum              |
| assignedDriver        | optional ObjectId |


Service Model

| Field       | Validation      |
| ----------- | --------------- |
| serviceCode | auto-generated  |
| serviceType | enum            |
| displayName | required        |
| description | optional        |
| baseFare    | positive number |
| active      | default true    |


Job MOdel
| Field               | Validation                |
| ------------------- | ------------------------- |
| jobNumber           | auto-generated            |
| pickupLocation      | required GeoJSON          |
| destinationLocation | optional                  |
| customerId          | required                  |
| driverId            | required after acceptance |
| vehicleId           | required after assignment |
| serviceId           | required                  |
| status              | enum                      |
| estimatedFare       | positive                  |
| finalFare           | positive                  |
| distance            | positive                  |
| duration            | positive                  |


Rating Model
| Field      | Validation    |
| ---------- | ------------- |
| stars      | integer 1–5   |
| review     | max 500 chars |
| jobId      | required      |
| customerId | required      |
| driverId   | required      |


Notification Model
| Field            | Validation    |
| ---------------- | ------------- |
| receiverId       | required      |
| title            | required      |
| message          | required      |
| notificationType | enum          |
| priority         | enum          |
| isRead           | default false |



Vehicle Location Model
| Field     | Validation    |
| --------- | ------------- |
| vehicleId | required      |
| driverId  | required      |
| location  | GeoJSON Point |
| heading   | 0–360         |
| speed     | positive      |
| accuracy  | positive      |
| timestamp | default now   |



