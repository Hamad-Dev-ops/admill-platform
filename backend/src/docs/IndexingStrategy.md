# Database Index Strategy

## Purpose

Indexes are added to improve query performance while avoiding unnecessary write overhead.

---

## Users

Unique Indexes

- email
- phone

Compound Index

- role + isActive

---

## Companies

Unique Indexes

- companyCode
- tradeLicenseNumber
- email

Indexes

- companyName

---

## Drivers

Unique Indexes

- employeeId
- nationalId
- drivingLicenseNumber

Indexes

- companyId
- status
- rating

Compound

- companyId + status

---

## Vehicles

Unique

- vehicleCode
- plateNumber
- chassisNumber

Indexes

- companyId
- assignedDriver
- vehicleType

Compound

- companyId + currentStatus

---

## Jobs

Unique

- jobNumber

Indexes

- companyId
- customerId
- driverId
- vehicleId
- status
- createdAt

Compound

- companyId + status
- driverId + status

---

## Vehicle Locations

Geospatial

- location (2dsphere)

Indexes

- vehicleId
- driverId
- timestamp

Compound

- vehicleId + timestamp

---

## Notifications

Indexes

- receiverId
- isRead
- createdAt

Compound

- receiverId + isRead