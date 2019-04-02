import { pick, isEmpty } from 'lodash';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import { mailer } from '@gqlapp/mailer-server-ts';
import { createTransaction } from '@gqlapp/database-server-ts';
import { log } from '@gqlapp/core-common';

import User from './sql';
import settings from '../../../settings';

const {
  auth: { secret, certificate, password },
  app
} = settings;

const createPasswordHash = password => {
  return bcrypt.hash(password, 12) || false;
};

const getUsers = async ({ body: { column, order, searchText = '', role = '', isActive = null } }, res) => {
  const orderBy = { column, order };
  const filter = { searchText, role, isActive };
  const users = await User.getUsers(orderBy, filter);

  res.json(users);
};

const addUser = async ({ body: input }, res) => {
  const errors = {};

  const userExists = await User.getUserByUsername(input.username);
  if (userExists) {
    errors.username = 'user:usernameIsExisted';
  }

  const emailExists = await User.getUserByEmail(input.email);
  if (emailExists) {
    errors.email = 'user:emailIsExisted';
  }

  if (input.password.length < password.minLength) {
    errors.password = 'user:passwordLength';
  }

  if (!isEmpty(errors)) throw new Error('Failed to get events due to validation errors');

  const passwordHash = await createPasswordHash(input.password);

  const trx = await createTransaction();
  let createdUserId;
  try {
    const isActive = password.requireEmailConfirmation ? input.isActive || false : !password.requireEmailConfirmation;

    [createdUserId] = await User.register({ ...input, isActive }, passwordHash).transacting(trx);
    await User.editUserProfile({ id: createdUserId, ...input }).transacting(trx);
    if (certificate.enabled) await User.editAuthCertificate({ id: createdUserId, ...input }).transacting(trx);
    trx.commit();
  } catch (e) {
    trx.rollback();
  }

  try {
    const user = await User.getUser(createdUserId);

    if (mailer && password.requireEmailConfirmation && !emailExists) {
      // async email
      jwt.sign({ identity: pick(user, 'id') }, secret, { expiresIn: '1d' }, (err, emailToken) => {
        const encodedToken = Buffer.from(emailToken).toString('base64');
        const url = `${__WEBSITE_URL__}/confirmation/${encodedToken}`;
        mailer.sendMail({
          from: `${app.name} <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: 'Your account has been created',
          html: `<p>Hi, ${user.username}!</p>
            <p>Welcome to ${app.name}. Please click the following link to confirm your email:</p>
            <p><a href="${url}">${url}</a></p>
            <p>Below are your login information</p>
            <p>Your email is: ${user.email}</p>`
        });
        log.info(`Sent registration confirmation email to: ${user.email}`);
      });
    }

    res.json({ user });
  } catch (e) {
    return e;
  }
};

const editUser = async ({ body: input }, res) => {
  const isAdmin = () => true;
  const isSelf = () => true;

  const errors = {};

  const userExists = await User.getUserByUsername(input.username);
  if (userExists && userExists.id !== input.id) {
    errors.username = 'user:usernameIsExisted';
  }

  const emailExists = await User.getUserByEmail(input.email);
  if (emailExists && emailExists.id !== input.id) {
    errors.email = 'user:emailIsExisted';
  }

  if (input.password && input.password.length < password.minLength) {
    errors.password = 'user:passwordLength';
  }

  if (!isEmpty(errors)) throw new Error('Failed to get events due to validation errors');

  const userInfo = !isSelf() && isAdmin() ? input : pick(input, ['id', 'username', 'email', 'password']);

  const isProfileExists = await User.isUserProfileExists(input.id);
  const passwordHash = await createPasswordHash(input.password);

  const trx = await createTransaction();
  try {
    await User.editUser(userInfo, passwordHash).transacting(trx);
    await User.editUserProfile(input, isProfileExists).transacting(trx);

    if (mailer && input.password && password.sendPasswordChangesEmail) {
      const url = `${__WEBSITE_URL__}/profile`;

      mailer.sendMail({
        from: `${settings.app.name} <${process.env.EMAIL_USER}>`,
        to: input.email,
        subject: 'Your Password Has Been Updated',
        html: `<p>Your account password has been updated.</p>
                 <p>To view or edit your account settings, please visit the “Profile” page at</p>
                 <p><a href="${url}">${url}</a></p>`
      });
      log.info(`Sent password has been updated to: ${input.email}`);
    }
    trx.commit();
  } catch (e) {
    trx.rollback(e);
  }

  if (certificate.enabled) {
    await User.editAuthCertificate(input);
  }

  try {
    const user = await User.getUser(input.id);

    res.json(user);
  } catch (e) {
    throw e;
  }
};

const deleteUser = async ({ body: { id } }, res) => {
  const isAdmin = () => true;
  const isSelf = () => false;

  const user = await User.getUser(id);
  if (!user) {
    throw new Error('userIsNotExisted');
  }

  if (isSelf()) {
    throw new Error('userCannotDeleteYourself');
  }

  const isDeleted = !isSelf() && isAdmin() ? await User.deleteUser(id) : false;

  if (isDeleted) {
    res.json(user);
  } else {
    throw new Error('userCouldNotDeleted');
  }
};

const restApi = [
  { route: '/getUsers', controller: getUsers, method: 'GET' },
  { route: '/addUser', controller: addUser, method: 'POST' },
  { route: '/editUser', controller: editUser, method: 'PUT' },
  { route: '/deleteUser', controller: deleteUser, method: 'DELETE' }
];

export default restApi;