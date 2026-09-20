export const documentSchemaOptions = {
  timestamps: true,
  optimisticConcurrency: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_document, result) => {
      delete result._id;
      delete result.clinicId;
      delete result.createdBy;
      delete result.updatedBy;
      return result;
    },
  },
};
