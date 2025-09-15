SELECT ID, delaytime, CLAZZ, servicename, CRON_EXPRESSION 
FROM serviceconfig 
WHERE servicename COLLATE utf8mb4_general_ci = ?;