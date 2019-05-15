# flujo subscription_ni.js :
**step 1** preparo parametros para helpers.getServiceOffers()

**step 2** ejecuto helpers.getServiceOffers() 
***
rs step 2 : **rs** || **err  
rs step 2  **rs** : El suscriptor ha sido suscrito. Suscripción activa o suspendida devuelta  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**subscription status:**  

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

&nbsp;&nbsp;&nbsp;&nbsp;aca solo implemento status 1 como rs para step3, el resto va a final respuesta al cliente json( err )  
rs step 2 **Err** : El suscriptor no ha sido suscrito todavía. Se devuelven las opciones de compra. (va a final respuesta al cliente json( err ))
***
**step final** : Envio respuesta al servidor json(**rs** || **err**)


