import { ActionResponse, After, Before, flat } from 'admin-bro';
import { merge } from 'lodash';
import { difference } from './utils/difference';

export const rememberInitialRecord: Before = async (request, context) => {
  const id = context.record?.id();

  context.initialRecord = id ? await context.resource.findOne(id) : {};
  return request;
};

export type CreateLogActionParams = {
  onlyForPostMethod?: boolean;
};

export const createLogAction = ({
  onlyForPostMethod = false,
}: CreateLogActionParams = {}): After<ActionResponse> => async (
  response,
  request,
  context
) => {
  const { currentAdmin, _admin } = context;
  const { params, method } = request;

  if (!params.recordId || (onlyForPostMethod && !(method === 'post'))) {
    return response;
  }

  try {
    const Log = _admin.findResource('Log');
    const ModifiedResource = _admin.findResource(params.resourceId);
    const modifiedRecord = merge(
      await ModifiedResource.findOne(params.recordId),
      JSON.parse(JSON.stringify(context.record))
    );
    if (!modifiedRecord) {
      return response;
    }

    const newParamsToCompare =
      params.action === 'delete'
        ? {}
        : flat.flatten(JSON.parse(JSON.stringify(modifiedRecord.params)));
    await Log.create({
      recordTitle:
        typeof modifiedRecord.title === 'string'
          ? modifiedRecord.title
          : modifiedRecord.title(),
      resource: params.resourceId,
      action: params.action,
      recordId:
        params.recordId ?? typeof modifiedRecord.id === 'string'
          ? modifiedRecord.id
          : modifiedRecord.id(),
      user: currentAdmin,
      difference: JSON.stringify(
        difference(
          newParamsToCompare,
          flat.flatten(JSON.parse(JSON.stringify(context.initialRecord.params)))
        )
      ),
    });
  } catch (e) {
    console.error(e);
  }
  return response;
};
