export class ResetPassowordModel{
    email: string
    otp: string
    newPassword: string
    constructor(email: string, otp: string, newPassword: string){
        this.email = email
        this.otp = otp
        this.newPassword = newPassword
    }
}