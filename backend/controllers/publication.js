import Publication from '../models/publication.js';
import Tags from '../models/tags.js';
import mongoose from 'mongoose';
import fs from 'fs';

export const getPublications = async (req, res) => {
    try {
        const { filter, page, limit } = req.query;
        let query = {};
        let sort = { createdAt: -1 };
        let skip = (page - 1) * limit;

        if (filter === 'Relevant') {
            query = { likes: { $gte: 5 } };
        } else if (filter === 'Latest') {
            query = { createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } };
            sort = { createdAt: -1 };
        } else if (filter === 'Top') {
            sort = { likes: -1 }
        }

    const populatedPublication = await Publication.find(query)
        .sort(sort)
        .limit(limit)
        .skip(skip)
        .populate('author')
        .populate('tags');

    let formatPublication = populatedPublication.map(publication => {
        return {
            id: publication._id,
            image: publication.image ? `http://localhost:3000/image/${publication.image}` : undefined,
            description: publication.description,
            date_create : publication.createdAt,
            date_update : publication.updatedAt,
            likesUser : publication.likesUser,
            likes : publication.likes,
            tags : publication.tags.map(e => {
                return {
                    id: e._id,
                    name: e.name,
                };
            }),
            author: {
                id: publication.author._id,
                username: publication.author.username,
                avatar: `http://localhost:3000/avatar/${publication.author.avatar}`,
            },
        };
    });
    return res.status(200).json({
        formatPublication,
    });
    } catch (err) {
    console.error('An error occurred', err);
    return res.status(500).json({
        message: err.message,
    });
    }
};


export const getPublication = async (req,res)=> {
    try {
        let id = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json(
                {
                    message : "invalid publicatin id"
                }
            )
        }
        let publication = await Publication.findById(id);
        if (!publication) {
            return res.status(404).json({ message: 'publication not found'})
        } ;
        return res.status(200).json({
            id : publication.id ,
            title : publication.title ,
            description : publication.description ,
            image : `http://localhost:3000/image/${publication.image}`
        });
    } catch (error) {
        console.error("An error occurred" , error);
        return res.status(500).json({
            message : error.message
        })
    }
}

export const CreatePublication = async (req, res) => {
    try {
        let { description, tags } = req.body;
        let author = req.profile;
        let image = req?.file?.filename;

        const tagNames = tags ? tags.map(tag => tag.toLowerCase()) : [];

        const foundTag = await Tags.find({ name: { $in : tagNames }})

        if(!foundTag ) foundTag = await new Tags({ name: tagNames }).save()

        let publication = new Publication({
            description,
            author: author.userId,
            tags: tags ? foundTag.map(tag => tag._id) : []
        });

        if (image) {
            publication.image = image;
        }

        const savePublication = await publication.save();

        if (savePublication) {
            const populatedPublication = await Publication.findById(publication._id)
            .populate('author')
            .populate('tags');
            return res.status(200).json({
                message: 'Publication created successfully.',
                publication: {
                    id: populatedPublication._id,
                    description: populatedPublication.description,
                    image: populatedPublication.image ? `http://localhost:3000/image/${populatedPublication.image}` : undefined,
                    date_create: populatedPublication.createdAt,
                    likesUser: populatedPublication.likesUser,
                    likes: populatedPublication.likes,
                    tags: populatedPublication.tags.map(e => {
                        return {
                            id: e._id,
                            name: e.name,
                        };
                    }),
                    author: {
                        id: populatedPublication.author._id,
                        username: populatedPublication.author.username,
                        avatar: `http://localhost:3000/avatar/${populatedPublication.author.avatar}`,
                    },
                },
            });
        } else {
            return res.status(401).json({
                message: 'Failed Creating Publication',
            });
        }
    } catch (err) {
        return res.status(500).json({
            message: err.message,
        });
    }
};

export const editPublication = async (req,res)=> {
    try {
        let id = req.params.id;
        let image = req?.file?.filename;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message : "invalid publication id"
            })
        }
        let { title, description} = req.body;
        let data = image ? {title , description ,image} : {title , description}
        let publication = await Publication.findByIdAndUpdate(id,data,{new : true , runValidators: true});
        if (!publication) {
            return res.status(404).json({ message: 'publication not found'})
        };
        return res.status(200).json({
            message : "this publication is updated successfully" ,
            id : publication.id ,
            title : publication.title ,
            description : publication.description ,
        });
    } catch (error) {
        console.error("An error occurred", error);
        return res.status(500).json({
            message : error.message
        })
    }
}

export const deletePublication = async (req, res) => {
    try {
    let { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
        message: "invalid publication id",
        });
    }
    let publication = await Publication.findById(id);
    if (!publication) {
        return res.status(404).json({ message: 'id not found' });
    }

    if (publication.image && fs.existsSync(`uploads/image/${publication.image}`)) {
        fs.unlinkSync(`uploads/image/${publication.image}`);
    }

    await Publication.findByIdAndDelete(id);
    return res.status(200).json({
        title: publication.title,
        id: publication.id,
        message: "this publication is deleted successfully",
    });
    } catch (error) {
    console.error("An error occurred", error);
    return res.status(500).json({
        message: error.message,
    });
    }
};

export const likePublication = async (req, res) => {
    const { postID, userID } = req.query;
    try {
        let publication = await Publication.findById(postID);
        if (!publication) {
            return res.status(404).json({
                success: false,
                message: "Publication not found"
            });
        }
        const userLiked = publication.likesUser.some(like => like === userID);
        if (userLiked) {
            publication.likesUser = publication.likesUser.filter(like => like !== userID);
            publication.likes -= 1;
        }else {
            publication.likesUser.push(userID);
            publication.likes += 1;
        }
        await publication.save();
        res.json({ success: true, likes: publication.likes, likesUser: publication.likesUser });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
