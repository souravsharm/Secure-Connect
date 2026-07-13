// Cardholder data templates
export const cardholderTemplates = {
  ExampleData:
    {
      "firstName": "James",
      "lastName": "Swan",
      "shortName": "CardAssigned",
      "description": "Manager",
      "authorised": true,
      "cards": [ //One or more
              {
                "referenceId": "533c154e-7625-4d3d-8fd8-a52f3d966ffe",
                "cardType": "Access",
                "serialNumber": "3029328098302893023980",
                "cardEncodedNumber": "389723987",
                "cardNumber": "ABC200",
                "activationDate": "2023-07-25T00:00:00Z",
                "expiryDate": "2027-09-25T00:00:00Z",
                "cardStatusCodeId": 2100,
                "lifeCycleState": "Expired",
                "cancellationReason": null,
                "cancellationDate": null
              },
              {
                "referenceId": "da5c154e-7625-4d3d-8fd8-4424f343df2",
                "cardType": "MSIC",
                "serialNumber": null,
                "cardEncodedNumber": null,
                "cardNumber": "OSC1020",
                "activationDate": "2023-07-25T00:00:00Z",
                "expiryDate": "2027-09-25T00:00:00Z",
                "cardStatusCodeId": 2100,
                "lifeCycleState": "Active",
                "cancellationReason": null,
                "cancellationDate": null
              }
            ],
      "division": {
        "href": "https://your-gallagher-server:8904/api/divisions/662"
      }
    },
  externalSystemSample: [
    {
      "traceId": "bd2d264e-7866-42d9-b97c-49453d44a95b", //Access have it. Will have to add for MSIC
      "source": "Access",      // Possible values, Access or MSIC. We can add this to header as well if needed.
      "destinationOrganisation": "ACME",  // Example destination organisation code
      "destinationSite": "ACME-SITE-1",  // Example destination site/facility code
      "payloadDateTime": "",  //UTC date and time stamp of payload creation.
      "type": "DEACTIVATE_CARD", //For future compatibility. For MSIC it will be empty string. Header will have source application.
      "person": {
        "referenceId": "5a5c154e-7625-4d3d-8fd8-a52f3d966ffe",     //for MSIC  it is applicant id, for access it is guid
        "firstName": "John",
        "middleName": "",
        "lastName": "CITIZEN",
        "address": null,
        "email": "john.citizen@example.com",
        "phone": null,
        "identityDocument": {
          "referenceId": "251da3-7625-4d3d-8fd8-a52f3d966ffe",         // this will be null for MSIC
          "documentNumber": "1234567890",
          "documentType": "Driver License",               // Driver License or Passport
          "documentIssuedBy": "NSW"                       // State or Coutnry. Eg. NSW if license or Australia/India if passport issueing contry.
        },
        "dob": "1990-01-01T00:00:00Z",
        "registrationType": "self",  // For Access self or invited. For MSIC single applicant
        "employer": null,  // This will have value if registrationType=invited, then will have value for this
        "employmentCategory": "EMPLOYEE-CONTRACTOR",
        "photo": "",
        "bans": [                 //Null for MSIC. One ore more for Access
          {
            "referenceId": "533c154e-7625-4d3d-8fd8-a52f3d966ffe",
            "facilityCode": "ACME-SITE-1",    // this must match with destination
            "banStatus": "OK",
            "banReason": null,
            "banType": "permanent",         //Temporary or Permanent
            "banExpiry": "2024-09-25T00:00:00Z"   // null for permanent ban
          }
        ],
        "cards": [ //One or more
          {
            "referenceId": "533c154e-7625-4d3d-8fd8-a52f3d966ffe",
            "cardType": "Access",
            "serialNumber": "3029328098302893023980",
            "cardEncodedNumber": "389723987",
            "cardNumber": "ABC123",
            "activationDate": "2024-07-25T00:00:00Z",
            "expiryDate": "2027-09-25T00:00:00Z",
            "cardStatusCodeId": 2100,
            "lifeCycleState": "Expired",
            "cancellationReason": null,
            "cancellationDate": null
          },
          {
            "referenceId": "da5c154e-7625-4d3d-8fd8-4424f343df2",
            "cardType": "MSIC",
            "serialNumber": null,
            "cardEncodedNumber": null,
            "cardNumber": "OSC23123",
            "activationDate": "2023-07-25T00:00:00Z",
            "expiryDate": "2027-09-25T00:00:00Z",
            "cardStatusCodeId": 2100,
            "lifeCycleState": "Active",
            "cancellationReason": null,
            "cancellationDate": null
          }
        ],
        "inductions": [  // one or more
          {
            "referenceId": "251da3-7625-4d3d-8fd8-a52f3d966ffe",
            "inductionRef": "223354",
            "InductionName": "",
            "InductionStatus": "Complete",
            "organisationCode": "ACME",
            "facilityCode": "ACME-SITE-1",
            "facilityInductionExpiryDate": "2024-09-25T00:00:00Z"
          }
        ]
      }
    }


  ],

  // Add more templates as needed
  basic: {
    "firstName": "",
    "lastName": "",
    "shortName": "",
    "description": "",
    "authorised": true,
    "division": {
      "href": ""
    },
    "operatorGroups": []
  },

  // Template with minimal required fields
  minimal: {
    "firstName": "Test",
    "lastName": "User",
    "shortName": "TU",
    "authorised": true,
    "division": {
      "href": ""
    }
  }
};

// Helper function to create cardholder data with dynamic values
export function createCardholderData(firstName, lastName, shortName, description = "", divisionHref = "") {
  return {
    "firstName": firstName,
    "lastName": lastName,
    "shortName": shortName,
    "description": description,
    "authorised": true,
    "division": {
      "href": divisionHref
    },
    "operatorGroups": []
  };
}
