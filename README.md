># flujo subscription_ni.js :

######step 1 preparo parametros para helpers.getServiceOffers()
######step 2 ejecuto helpers.getServiceOffers() 
******************************************************************************************************

######rs step 2  caso exitoso : El suscriptor ha sido suscrito. Suscripción activa o suspendida devuelta
######rs step 2 : rs || err
######**subscription status:**
        + 1 : Active
        + 2 : Reserved
        + 3 : Being Provisioned
        + 4 : Suspended
        + 5 : Grace Period
        + 6 : Being Deprovisioned
        + 7 : Reserved Closed
        + 11 : Inactive
        + 12 : Closed
        + 21 : System Failed
        + 22 : Payment Failed
        + 23 : Provisioning Failed
        + 24 : Cancelled
        + 26 : Rolled Back
        + 30 : Goodwill Credit Failed

######aca solo implemento status 1 como rs para step3, el resto va a final respuesta al cliente json( err )
######Err : El suscriptor no ha sido suscrito todavía. Se devuelven las opciones de compra. (va a final respuesta al cliente json( err ))
******************************************************************************************************

######El socio debe indicar al agente de usuario del navegador web que abra el enlace de la URL específica que se previsto. Esto es para asegurar que Vodacom valida la transacción recibida del Socio.
######step 3 preparo parametros para helpers.chargeRequestWhitEncriptedMsisdn()
######step 4 ejecuto helpers.chargeRequestWhitEncriptedMsisdn()
******************************************************************************************************

######step 4 rs :
######Redirigir el navegador a la página web del Socio
######  **Redirect Responses Codes (URL - Redirect):**
        + 0 ACCEPTED : Successfully subscribed
        + 1 DECLINED : Customer declined
        + 2 FRAUD : Fraud detected 
        + 3 ERROR : An error has occurred 
        + 4 BLOCKED : Content block flag set
        + 5 ERROR : Insufficient funds 
        + 6 ERROR : Timeout waiting for response 
        + 7 ERROR : Already subscribed to service 
        + 8 ERROR : Invalid request 
        + 9 BLOCKED : Admin lock flag set

######Activar una respuesta de devolución de llamada en segundo plano
######    -timeout transacción completa: 3 minutos. Se enviará una notificación de timeout.
######        si : !transacción completa 
######            entonces : volver al socio tercero

>## Vodacom informa al socio DCB si el suscriptor rechaza la solicitud de suscripción
******************************************************************************************************

######step 5 envio respuesta al cliente json( rs | err )