import { UserIdRequestModel } from "./userid-request-model";

export class UpdateUserModel extends UserIdRequestModel {
    username: string;
    password: string;
    email: string;
    profilePicture: string;
    contacts: string[];

    constructor(
        userId: string,
        username: string,
        password: string,
        email: string,
        profilePicture: string = '',
        contacts: string[] = []
    ) {
        super(userId);
        this.username = username;
        this.password = password;
        this.email = email;
        this.profilePicture = profilePicture;
        this.contacts = contacts;
    }
}
