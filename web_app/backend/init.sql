CREATE TABLE IF NOT EXISTS hospitals (
    hospital_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address_label VARCHAR(100) NOT NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(10,8) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    registration_no VARCHAR(50),
    hospital_type VARCHAR(50),
    support_email VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS drivers (
    driver_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    license_number VARCHAR(50) NOT NULL UNIQUE,
    vehicle_number VARCHAR(30) NOT NULL,
    vehicle_type VARCHAR(50) DEFAULT 'Ambulance',
    userid VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    latitude DECIMAL(10,8) DEFAULT 0.00000000,
    longitude DECIMAL(11,8) DEFAULT 0.00000000,
    status ENUM('Available','Busy','Offline') DEFAULT 'Offline',
    affiliated_hospital_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (affiliated_hospital_id) REFERENCES hospitals(hospital_id)
);

CREATE TABLE IF NOT EXISTS patients (
    patient_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    dob DATE NOT NULL,
    gender ENUM('Male','Female','Other') NOT NULL,
    blood_group VARCHAR(5),
    contact_number VARCHAR(20) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    address TEXT,
    known_allergies TEXT,
    userid VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS family_members (
    member_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    relation VARCHAR(50) NOT NULL,
    dob DATE,
    gender ENUM('Male','Female','Other'),
    blood_group VARCHAR(5),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS treatments (
    treatment_id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT,
    treatment_name VARCHAR(255) NOT NULL,
    cost INT NOT NULL,
    available_beds INT NOT NULL,
    total_rating INT DEFAULT 0,
    rating_count INT DEFAULT 0,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(hospital_id)
);

CREATE TABLE IF NOT EXISTS bookings (
    booking_id VARCHAR(255) PRIMARY KEY,
    patient_email VARCHAR(100),
    patient_name VARCHAR(150),
    hospital_id INT,
    treatment_id INT,
    status VARCHAR(50),
    FOREIGN KEY (hospital_id) REFERENCES hospitals(hospital_id),
    FOREIGN KEY (treatment_id) REFERENCES treatments(treatment_id)
);

CREATE TABLE IF NOT EXISTS hospital_driver_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT,
    driver_id INT,
    approval_code VARCHAR(50),
    status VARCHAR(50),
    FOREIGN KEY (hospital_id) REFERENCES hospitals(hospital_id),
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
);

CREATE TABLE IF NOT EXISTS reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT,
    treatment_id INT,
    booking_id VARCHAR(255),
    doctor_care INT NOT NULL,
    hygiene INT NOT NULL,
    staff_behavior INT NOT NULL,
    overall_rating DECIMAL(3,2) NOT NULL,
    written_review TEXT,
    date_submitted DATE NOT NULL,
    facilities INT DEFAULT 0,
    speed_of_service INT DEFAULT 0,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(hospital_id),
    FOREIGN KEY (treatment_id) REFERENCES treatments(treatment_id),
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
);
